import { createClient } from "@supabase/supabase-js";
import { calculateCost } from "./pricing";

/**
 * Unified AI provider interface
 * Supports OpenAI, Anthropic (Claude), and Google Gemini
 *
 * Updated 2026: handles GPT-5.x (max_completion_tokens) and Gemini 3.x (systemInstruction),
 * while remaining backward-compatible with older models.
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

  // Fetch user's AI provider configuration
  const { data: apiKey, error: keyError } = await supabase
    .from("gpt_api_keys")
    .select("provider, model, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (keyError || !apiKey) {
    throw new Error(
      "Configuração de IA não encontrada. Por favor, configure a sua chave de API nas definições."
    );
  }

  const { provider, model, api_key } = apiKey as { provider: string; model: string; api_key: string };

  // Update last_used_at timestamp
  await supabase
    .from("gpt_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_active", true);

  console.log(`[AI Provider] Task: ${task} | Provider: ${provider} | Model: ${model}`);

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

  let systemPrompt = systemMessage?.content || "";

  if (jsonMode && !systemPrompt.includes("JSON")) {
    systemPrompt += "\n\nResponde APENAS em JSON válido. Não incluas markdown nem texto antes ou depois do JSON.";
  }

  const requestBody: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: conversationMessages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
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
  let systemText = systemMessage?.content || "";
  if (jsonMode) {
    systemText += "\n\nResponde APENAS em JSON válido. Não incluas markdown nem texto antes ou depois do JSON.";
  }

  // Conversation content goes into parts
  const parts = conversationMessages.map(msg => ({ text: msg.content }));

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
