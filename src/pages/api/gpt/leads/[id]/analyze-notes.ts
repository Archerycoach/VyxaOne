import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getNotesFieldExtractionPrompt } from "@/lib/ai/prompts/notesFieldExtraction";
import { getLeadQualification, formatCurrentQualificationValue, mapExtractedDataToLeadUpdate } from "@/lib/leadQualification";

/**
 * Analisa as notas de uma lead (ex.: respostas de formulários da Meta que
 * não bateram com nenhuma regra fixa de mapeamento, ou anotações livres do
 * consultor) e tenta extrair dados de qualificação em falta.
 *
 * Dois modos (body.mode):
 * - "review" (por defeito): só analisa e devolve o que encontrou, sem
 *   gravar nada — para o consultor rever e confirmar manualmente.
 * - "auto": analisa E aplica imediatamente, mas SÓ em campos que a lead
 *   ainda tem vazios (nunca sobrescreve um campo já preenchido). Usado pelo
 *   webhook da Meta para preencher automaticamente o que a extração
 *   determinística não apanhou.
 */

interface LeadNote {
  note: string;
  created_at: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "PUT") {
    try {
      const leadId = req.query.id as string;
      if (!leadId) return res.status(400).json({ error: "Lead ID is required" });

      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Missing authorization token" });

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

      const fields = req.body?.fields;
      if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "Sem campos para aplicar" });
      }

      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .eq("user_id", user.id)
        .single();

      if (!lead) return res.status(404).json({ error: "Lead not found" });

      // Revisão manual e confirmada pelo consultor: pode substituir valores
      // existentes (ao contrário do modo "auto", que só preenche vazios).
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (updateError) return res.status(500).json({ error: updateError.message });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Analyze Notes] Erro ao aplicar (PUT):", error);
      return res.status(500).json({ error: error.message || "Erro interno ao aplicar." });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const leadId = req.query.id as string;
    if (!leadId) return res.status(400).json({ error: "Lead ID is required" });

    // Autenticação: aceita token de utilizador (uso manual) OU o segredo de
    // cron/serviço (chamadas automáticas vindas de webhooks/crons internos).
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    let userId: string | null = null;
    if (token === process.env.CRON_SECRET) {
      // Chamada automática interna: o user_id vem no corpo do pedido.
      userId = (req.body?.userId as string) || null;
    } else {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
      userId = user.id;
    }

    if (!userId) return res.status(400).json({ error: "userId em falta" });

    const mode: "review" | "auto" = req.body?.mode === "auto" ? "auto" : "review";

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (leadError || !lead) return res.status(404).json({ error: "Lead not found" });

    const { missing } = getLeadQualification(lead);

    if (missing.length === 0) {
      return res.status(200).json({ extracted: {}, applied: {}, message: "Lead já está totalmente qualificada." });
    }

    const { data: notesData } = await supabaseAdmin
      .from("lead_notes")
      .select("note, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<LeadNote[]>();

    // Inclui também o campo "notes" da própria lead — é onde ficam as
    // respostas originais de um formulário da Meta numa lead NOVA (nas
    // leads já existentes que reenviam o formulário, o texto vai antes para
    // a tabela lead_notes, já incluída acima).
    const noteEntries = (notesData || []).map((n) => n.note);
    if (typeof lead.notes === "string" && lead.notes.trim()) {
      noteEntries.unshift(lead.notes);
    }
    const notesText = noteEntries.join("\n\n---\n\n");

    if (!notesText.trim()) {
      return res.status(200).json({ extracted: {}, applied: {}, message: "Esta lead não tem notas para analisar." });
    }

    const qualificationFields = missing.map((field) => ({
      key: field.key,
      label: field.label,
      currentValue: formatCurrentQualificationValue(lead, field.key),
    }));

    const prompt = getNotesFieldExtractionPrompt({
      leadName: lead.name,
      notesText,
      qualificationFields,
    });

    const aiResponse = await runAI({
      userId,
      task: "notes_field_extraction",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.2,
    });

    let extractedData: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(aiResponse.text);
      if (parsed.extracted_data && typeof parsed.extracted_data === "object") {
        extractedData = parsed.extracted_data;
      }
    } catch (parseError) {
      console.error("[Analyze Notes] Erro ao interpretar resposta da IA:", parseError);
    }

    const proposedUpdate = mapExtractedDataToLeadUpdate(extractedData);

    if (mode === "review") {
      return res.status(200).json({ extracted: proposedUpdate, applied: {} });
    }

    // Modo "auto": só preenche campos que a lead ainda tem vazios — nunca
    // sobrescreve um valor já existente.
    const fieldsToFill: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(proposedUpdate)) {
      const currentValue = (lead as Record<string, unknown>)[key];
      if (currentValue === undefined || currentValue === null || currentValue === "") {
        fieldsToFill[key] = value;
      }
    }

    if (Object.keys(fieldsToFill).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ ...fieldsToFill, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (updateError) {
        console.error("[Analyze Notes] Erro ao aplicar campos:", updateError);
        return res.status(500).json({ error: updateError.message });
      }
    }

    return res.status(200).json({ extracted: proposedUpdate, applied: fieldsToFill });
  } catch (error: any) {
    console.error("[Analyze Notes] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao analisar notas." });
  }
}
