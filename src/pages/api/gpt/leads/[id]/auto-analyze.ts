import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runLeadAutoAnalysis, type LeadAutoAnalysisTrigger } from "@/lib/server/leadAutoAnalysis";

/**
 * Análise automática de uma lead, despoletada pelo cliente (fire-and-forget)
 * sempre que o consultor adiciona uma nota ou regista uma interação — ver
 * notesService.createNote e interactionsService.createInteraction.
 *
 * Toda a lógica (guardas, IA, aplicação híbrida, notificação) vive em
 * src/lib/server/leadAutoAnalysis.ts, partilhada com o fluxo de nota de voz.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const leadId = req.query.id as string;
  if (!leadId) {
    return res.status(400).json({ error: "Lead ID inválido" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { newContent, trigger } = (req.body || {}) as { newContent?: string; trigger?: string };
  if (!newContent || typeof newContent !== "string" || !newContent.trim()) {
    return res.status(400).json({ error: "newContent em falta" });
  }

  const validTriggers: LeadAutoAnalysisTrigger[] = ["note", "interaction", "voice_note"];
  const resolvedTrigger: LeadAutoAnalysisTrigger = validTriggers.includes(trigger as LeadAutoAnalysisTrigger)
    ? (trigger as LeadAutoAnalysisTrigger)
    : "note";

  // runLeadAutoAnalysis valida que a lead pertence ao utilizador e nunca
  // lança — devolve sempre um resultado.
  const result = await runLeadAutoAnalysis({
    supabaseAdmin,
    userId: user.id,
    leadId,
    trigger: resolvedTrigger,
    newContent,
  });

  return res.status(200).json(result);
}
