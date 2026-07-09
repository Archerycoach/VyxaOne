import { createClient } from "@supabase/supabase-js";
import { calculateCost } from "./pricing";
import { resolveAiKey } from "./keys";

/**
 * Unified AI provider interface
 * Supports OpenAI, Anthropic (Claude), and Google Gemini
 *
 * Updated 2026: handles GPT-5.x (max_completion_tokens) and Gemini 3.x (systemInstruction),
 * while remaining backward-compatible with older models.
 */

// Formato de conteúdo multimodal usado pelos chamadores (mesmo formato da
// OpenAI, já usado antes desta mudança) — cada provider traduz para o seu
// próprio formato de imagem em callOpenAI/callAnthropic/callGoogleGemini.
export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | AIContentPart[];
}

// "data:image/jpeg;base64,XXXX" -> { mediaType: "image/jpeg", base64: "XXXX" }
function parseDataUrl(url: string): { mediaType: string; base64: string } {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagem inválido — esperado um data URL base64.");
  }
  return { mediaType: match[1], base64: match[2] };
}

// Traduz o conteúdo (texto simples, ou texto+imagem no formato da OpenAI)
// para o formato de blocos de conteúdo da Anthropic.
function toAnthropicContent(content: string | AIContentPart[]): any {
  if (typeof content === "string") return content;

  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    const { mediaType, base64 } = parseDataUrl(part.image_url.url);
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  });
}

// Traduz o conteúdo para blocos de "parts" da Gemini (texto e/ou inlineData).
function toGeminiParts(content: string | AIContentPart[]): any[] {
  if (typeof content === "string") return [{ text: content }];

  return content.map((part) => {
    if (part.type === "text") return { text: part.text };
    const { mediaType, base64 } = parseDataUrl(part.image_url.url);
    return { inlineData: { mimeType: mediaType, data: base64 } };
  });
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
}

export interface RunAIParams {
  userId: string;
  task: string; // High-level task description for logging/debugging
  messages: AIMessage[];
  jsonMode?: boolean; // Force JSON output
  temperature?: number;
  maxTokens?: number;
}

/**
 * Normalizes and executes AI requests across multiple providers
 */
export async function runAI(params: RunAIParams): Promise<AIResponse> {
  const { userId, task, messages, jsonMode = false, temperature = 0.7, maxTokens = 2048 } = params;

  // Initialize Supabase client (use service role key for server-side calls)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Chave própria do utilizador, com reserva na chave da agência (ver lib/ai/keys.ts)
  const { provider, model, apiKey: api_key, scope } = await resolveAiKey(userId, supabase);

  if (scope === "user") {
    await supabase
      .from("gpt_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_active", true);
  }

  console.log(`[AI Provider] Task: ${task} | Provider: ${provider} | Model: ${model} | Key scope: ${scope}`);

  let response: AIResponse;

  // Dispatch to the appropriate provider
  switch (provider.toLowerCase()) {
    case "openai":
      response = await callOpenAI(api_key, model, messages, jsonMode, temperature, maxTokens);
      break;
    case "anthropic":
      response = await callAnthropic(api_key, model, messages, jsonMode, temperature, maxTokens);
      break;
    case "google":
      response = await callGoogleGemini(api_key, model, messages, jsonMode, temperature, maxTokens);
      break;
    default:
      throw new Error(`Fornecedor de IA não suportado: ${provider}`);
  }

  // Log usage automatically
  const estimatedCost = calculateCost(model, response.usage.inputTokens, response.usage.outputTokens);

  await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    task,
    provider,
    model,
    input_tokens: response.usage.inputTokens,
    output_tokens: response.usage.outputTokens,
    estimated_cost: estimatedCost,
  });

  console.log(`[AI Provider] Usage logged: ${response.usage.inputTokens} in + ${response.usage.outputTokens} out = ${estimatedCost.toFixed(6)} USD`);

  return response;
}

/**
 * OpenAI API call
 *
 * GPT-5.x (and other newer reasoning models) require `max_completion_tokens`
 * instead of `max_tokens`, and only accept the default temperature.
 * Older models (gpt-4o, gpt-4o-mini, gpt-3.5-turbo) keep the legacy params.
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  jsonMode: boolean,
  temperature: number,
  maxTokens: number
): Promise<AIResponse> {
  // Newer model families (gpt-5*, o1*, o3*, o4*) use the updated parameter names.
  const isNewModelFamily = /^(gpt-5|o1|o3|o4)/i.test(model);

  const requestBody: any = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  if (isNewModelFamily) {
    // New families: token limit param renamed; temperature must be left at default.
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
    requestBody.temperature = temperature;
  }

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API da OpenAI: ${errorText}`);
  }

  const data = await response.json();

  let text = data.choices[0]?.message?.content || "";

  // Clean up potential markdown blocks that OpenAI sometimes returns
  if (jsonMode) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  return {
    text,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Anthropic (Claude) API call
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  jsonMode: boolean,
  temperature: number,
  maxTokens: number
): Promise<AIResponse> {
  // Anthropic requires system messages to be separate
  const systemMessage = messages.find(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  let systemPrompt = typeof systemMessage?.content === "string" ? systemMessage.content : "";

  if (jsonMode && !systemPrompt.includes("JSON")) {
    systemPrompt += "\n\nResponde APENAS em JSON válido. Não incluas markdown nem texto antes ou depois do JSON.";
  }

  const requestBody: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: conversationMessages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: toAnthropicContent(m.content),
    })),
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API da Anthropic: ${errorText}`);
  }

  const data = await response.json();

  let text = data.content[0]?.text || "";

  // Clean up potential markdown blocks
  if (jsonMode) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
}

/**
 * Google Gemini API call
 *
 * Newer Gemini models expect the system instruction in a dedicated
 * `systemInstruction` field rather than mixed into the content parts.
 */
async function callGoogleGemini(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  jsonMode: boolean,
  temperature: number,
  maxTokens: number
): Promise<AIResponse> {
  const systemMessage = messages.find(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  // Build the system instruction text (system message + optional JSON directive)
  let systemText = typeof systemMessage?.content === "string" ? systemMessage.content : "";
  if (jsonMode) {
    systemText += "\n\nResponde APENAS em JSON válido. Não incluas markdown nem texto antes ou depois do JSON.";
  }

  // Conversation content goes into parts (texto e/ou imagem)
  const parts = conversationMessages.flatMap(msg => toGeminiParts(msg.content));

  const requestBody: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode && { responseMimeType: "application/json" }),
    },
  };

  if (systemText.trim()) {
    requestBody.systemInstruction = { parts: [{ text: systemText }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API do Google Gemini: ${errorText}`);
  }

  const data = await response.json();

  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Clean up potential markdown blocks
  if (jsonMode) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  return {
    text,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}
