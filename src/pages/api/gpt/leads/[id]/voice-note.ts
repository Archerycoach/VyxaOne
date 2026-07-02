import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getVoiceNoteAnalysisPrompt, type QualificationFieldContext } from "@/lib/ai/prompts/voiceNoteAnalysis";
import { getLeadQualification, formatCurrentQualificationValue, mapExtractedDataToLeadUpdate } from "@/lib/leadQualification";
import { storeMemory } from "@/lib/ai/embeddings";
import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

// Temporary types until these tables are added to database.types.ts
interface GptApiKey {
  provider: string;
  api_key: string;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Lê e faz parse do corpo JSON manualmente. Necessário porque
 * "bodyParser: false" está desligado para todo este ficheiro (exigido pelo
 * POST, que lê um upload multipart de áudio com o formidable) — isso também
 * desliga o parsing automático do corpo no PUT, que por sua vez espera JSON.
 */
async function readJsonBody(req: NextApiRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error("Corpo do pedido inválido (JSON malformado)"));
      }
    });
    req.on("error", reject);
  });
}

async function transcribeAudio(audioBuffer: Buffer, userId: string): Promise<string> {
  // Get user's AI configuration
  const { data: apiKey } = await supabaseAdmin
    .from("gpt_api_keys")
    .select("provider, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<GptApiKey>()
    .maybeSingle();

  if (!apiKey) {
    throw new Error("Configuração de IA não encontrada");
  }

  const { provider, api_key } = apiKey;

  // Use OpenAI Whisper for all providers (standard transcription)
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
      Authorization: `Bearer ${api_key}`,
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

  // POST: Transcribe and analyze voice note
  if (req.method === "POST") {
    try {
      const form = formidable({});
      const [fields, files] = await form.parse(req);

      const audioFile = files.audio?.[0];
      if (!audioFile) {
        return res.status(400).json({ error: "Ficheiro de áudio não encontrado" });
      }

      // Read audio file
      const audioBuffer = fs.readFileSync(audioFile.filepath);

      // Transcribe audio
      console.log(`[Voice Note] Transcribing audio for lead ${leadId}...`);
      const transcription = await transcribeAudio(audioBuffer, user.id);
      console.log(`[Voice Note] Transcription complete: ${transcription.substring(0, 100)}...`);

      // Get lead data
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("user_id", user.id)
        .single();

      if (!lead) {
        return res.status(404).json({ error: "Lead não encontrada" });
      }

      // Get recent interactions
      const { data: interactions } = await supabaseAdmin
        .from("interactions")
        .select("*")
        .eq("lead_id", leadId)
        .order("interaction_date", { ascending: false })
        .limit(5);

      // Campos de qualificação relevantes para esta lead (comprador/vendedor/
      // ambos), com o valor atual — para a IA saber o que já sabemos e o que
      // vale a pena tentar extrair da transcrição.
      const { relevantFields } = getLeadQualification(lead);
      const qualificationFields: QualificationFieldContext[] = relevantFields.map((field) => ({
        key: field.key,
        label: field.label,
        currentValue: formatCurrentQualificationValue(lead, field.key),
      }));

      // Analyze transcription with AI
      const prompt = getVoiceNoteAnalysisPrompt({
        transcription,
        leadData: {
          name: lead.name,
          status: lead.status,
          temperature: lead.temperature || "cold",
          property_type: lead.property_type,
          location_preference: lead.location_preference,
          budget: lead.budget,
        },
        recentInteractions: interactions || [],
        qualificationFields,
      });

      const aiResponse = await runAI({
        userId: user.id,
        task: "voice_note_analysis",
        messages: [{ role: "user", content: prompt }],
        jsonMode: true,
        temperature: 0.3,
      });

      const analysis = JSON.parse(aiResponse.text);

      return res.status(200).json({
        transcription,
        analysis,
      });
    } catch (error: any) {
      console.error("[Voice Note] Error processing:", error);
      return res.status(500).json({ error: error.message || "Erro ao processar nota de voz" });
    }
  }

  // PUT: Apply changes from voice note analysis
  if (req.method === "PUT") {
    try {
      const { transcription, analysis } = await readJsonBody(req);

      if (!transcription || !analysis) {
        return res.status(400).json({ error: "Dados incompletos" });
      }

      // Verify lead belongs to user
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("user_id", user.id)
        .single();

      if (!lead) {
        return res.status(404).json({ error: "Lead não encontrada" });
      }

      const now = new Date().toISOString();

      // 1. Create interaction
      await supabaseAdmin.from("interactions").insert({
        lead_id: leadId,
        user_id: user.id,
        interaction_type: "meeting",
        content: `📝 Nota de voz: ${analysis.summary}\n\nTranscrição: "${transcription}"`,
        outcome: analysis.summary,
        interaction_date: now,
      });

      // 2. Update lead status, temperature, and any qualification data
      // detetada na transcrição (orçamento, tipologia, prazo, etc.)
      const qualificationUpdate = mapExtractedDataToLeadUpdate(analysis.extracted_data);

      await supabaseAdmin
        .from("leads")
        .update({
          status: analysis.suggested_status,
          temperature: analysis.suggested_temperature,
          last_contact_date: now,
          updated_at: now,
          ...qualificationUpdate,
        })
        .eq("id", leadId);

      // 3. Create task if suggested
      if (analysis.suggested_task) {
        await supabaseAdmin.from("tasks").insert({
          user_id: user.id,
          related_lead_id: leadId,
          title: analysis.suggested_task.title,
          description: analysis.suggested_task.description,
          due_date: analysis.suggested_task.due_date,
          priority: analysis.suggested_task.priority,
          status: "pending",
        });
      }

      // 4. Store in lead_memory for long-term AI context
      await storeMemory({
        leadId,
        userId: user.id,
        source: "voice_note",
        content: `${analysis.summary}\n\nTranscrição: "${transcription}"`,
        supabaseClient: supabaseAdmin,
      });

      console.log(`✅ Voice note processed for lead ${leadId}`);

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Voice Note] Error applying changes:", error);
      return res.status(500).json({ error: error.message || "Erro ao aplicar alterações" });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}