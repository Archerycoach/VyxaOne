import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runLeadAutoAnalysis } from "@/lib/server/leadAutoAnalysis";
import { resolveAiKey, resolveAiKeyForProvider } from "@/lib/ai/keys";
import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

const DEFAULT_GEMINI_AUDIO_MODEL = "gemini-3.5-flash";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Nota de voz TOTALMENTE automática (sem ecrã de confirmação):
 * 1. Transcreve o áudio (Whisper ou Gemini, conforme a chave do consultor).
 * 2. Grava a transcrição nas notas da lead (lead_notes).
 * 3. Regista a interação e atualiza o último contacto (uma nota de voz
 *    pós-visita é um contacto genuíno).
 * 4. Corre a análise automática de IA partilhada (temperatura, status,
 *    qualificação, tarefas, blocos de agenda "por confirmar", notificação)
 *    — ver src/lib/server/leadAutoAnalysis.ts.
 * 5. Devolve a transcrição e o resumo do que foi aplicado, para a UI mostrar
 *    o cartão "O que a IA fez".
 */

async function transcribeAudio(audioBuffer: Buffer, userId: string): Promise<string> {
  const primaryKey = await resolveAiKey(userId, supabaseAdmin);

  if (primaryKey.provider === "openai") {
    return transcribeWithWhisper(audioBuffer, primaryKey.apiKey);
  }

  // O Claude não processa áudio — para quem tem a Anthropic como fornecedor
  // principal, usamos uma chave Google (Gemini, que processa áudio
  // nativamente) que o próprio já tenha configurada, principal ou secundária.
  const googleKey = primaryKey.provider === "google"
    ? primaryKey
    : await resolveAiKeyForProvider(userId, "google", supabaseAdmin);

  if (!googleKey) {
    throw new Error(
      "Para transcrever notas de voz é necessária uma chave do Google Gemini nas Definições de IA — o fornecedor atual não processa áudio."
    );
  }

  return transcribeWithGemini(audioBuffer, googleKey.apiKey, googleKey.model);
}

async function transcribeWithWhisper(audioBuffer: Buffer, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: "audio.webm",
    contentType: "audio/webm",
  });
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na transcrição: ${error}`);
  }

  const data: any = await response.json();
  return data.text;
}

async function transcribeWithGemini(audioBuffer: Buffer, apiKey: string, model?: string): Promise<string> {
  const geminiModel = model && model.startsWith("gemini") ? model : DEFAULT_GEMINI_AUDIO_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Transcreve fielmente o áudio seguinte em português. Responde apenas com a transcrição, sem comentários adicionais." },
          { inlineData: { mimeType: "audio/webm", data: audioBuffer.toString("base64") } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na transcrição: ${error}`);
  }

  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: leadId } = req.query;

  if (!leadId || typeof leadId !== "string") {
    return res.status(400).json({ error: "Lead ID inválido" });
  }

  // Verify authentication
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Token inválido" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const form = formidable({});
    const [, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: "Ficheiro de áudio não encontrado" });
    }

    // Verify lead belongs to user BEFORE spending AI credits
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    // 1. Transcribe audio
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    console.log(`[Voice Note] Transcribing audio for lead ${leadId}...`);
    const transcription = await transcribeAudio(audioBuffer, user.id);
    console.log(`[Voice Note] Transcription complete: ${transcription.substring(0, 100)}...`);

    if (!transcription.trim()) {
      return res.status(422).json({ error: "Não foi possível transcrever o áudio (transcrição vazia)." });
    }

    const now = new Date().toISOString();

    // 2. Gravar a transcrição nas notas da lead — automático, sem confirmação.
    const { error: noteError } = await supabaseAdmin.from("lead_notes").insert({
      lead_id: leadId,
      created_by: user.id,
      note: `🎙️ Nota de voz (transcrição automática):\n${transcription}`,
    });
    if (noteError) {
      console.error(`[Voice Note] Erro ao gravar nota (lead ${leadId}):`, noteError);
    }

    // 3. Registar a interação e atualizar o último contacto.
    const { error: interactionError } = await supabaseAdmin.from("interactions").insert({
      lead_id: leadId,
      user_id: user.id,
      interaction_type: "meeting",
      content: `📝 Nota de voz: "${transcription}"`,
      interaction_date: now,
    });
    if (interactionError) {
      console.error(`[Voice Note] Erro ao registar interação (lead ${leadId}):`, interactionError);
    }

    await supabaseAdmin
      .from("leads")
      .update({ last_contact_date: now, updated_at: now })
      .eq("id", leadId);

    // 4. Análise automática partilhada (aplica temperatura/status/tarefas,
    // cria blocos de agenda "por confirmar" e notifica o consultor). Ignora o
    // debounce: uma nota de voz é sempre conteúdo novo relevante.
    const analysisResult = await runLeadAutoAnalysis({
      supabaseAdmin,
      userId: user.id,
      leadId,
      trigger: "voice_note",
      newContent: transcription,
      skipDebounce: true,
    });

    return res.status(200).json({
      transcription,
      analysis: analysisResult.ran ? analysisResult.applied : null,
      analysisSkippedReason: analysisResult.ran ? null : analysisResult.skippedReason,
    });
  } catch (error: any) {
    console.error("[Voice Note] Error processing:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar nota de voz" });
  }
}
