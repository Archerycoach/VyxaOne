import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";

export const config = { maxDuration: 30 };

/**
 * "Sugerir resposta" — gera um RASCUNHO de resposta para um lembrete, no estilo
 * do consultor. NÃO envia nada (human-in-the-loop): o consultor revê e envia.
 *
 * Nota RGPD: não guardamos o corpo do email original, por isso o rascunho
 * baseia-se no que foi derivado (lembrete/conselho) + contexto da lead + estilo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Falta o id do lembrete." });

  const db = supabaseAdmin as any;

  try {
    const { data: item } = await db
      .from("inbox_triage")
      .select("from_name, reminder, advice, intent, lead_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!item) return res.status(404).json({ error: "Lembrete não encontrado." });

    const { data: settings } = await db
      .from("user_smtp_settings")
      .select("inbox_reply_style, from_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const style = (settings?.inbox_reply_style as string) || "";
    const signature = (settings?.from_name as string) || "";

    // Contexto da lead, se houver.
    let leadContext = "";
    if (item.lead_id) {
      const { data: lead } = await db
        .from("leads")
        .select("name, status, temperature, last_contact_date")
        .eq("id", item.lead_id)
        .maybeSingle();
      if (lead) {
        leadContext = `Lead: ${lead.name || ""}; estado=${lead.status || "-"}; temperatura=${lead.temperature || "-"}.`;
      }
    }

    const prompt = `És o assistente de um consultor imobiliário. Escreve um RASCUNHO de resposta de email, pronto a rever e enviar (NÃO o envies). Português de Portugal, tom profissional e cordial.

CONTEXTO:
- De: ${item.from_name || "cliente"}
- Assunto/atenção: ${item.reminder || ""}
- O que fazer: ${item.advice || ""}
- Intenção: ${item.intent || "outro"}
${leadContext ? `- ${leadContext}` : ""}
${style ? `- ESTILO do consultor a imitar: ${style}` : ""}

Regras: sê concreto e breve; propõe uma próxima ação clara (ex.: dois horários para visita); não inventes factos que não conheces (preços, moradas) — deixa espaço [assim] para o consultor preencher se necessário.${signature ? ` Assina como "${signature}".` : ""}

Devolve APENAS o corpo do email (sem assunto, sem JSON, sem aspas).`;

    const response = await runAI({
      userId: user.id,
      task: "inbox_reply_draft",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 700,
    });

    return res.status(200).json({ draft: (response.text || "").trim() });
  } catch (error: any) {
    console.error("[inbox-assistant/draft] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar rascunho." });
  }
}
