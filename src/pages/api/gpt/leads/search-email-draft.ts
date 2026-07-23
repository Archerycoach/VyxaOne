import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { findMatchesForLead } from "@/services/matchingService";

/**
 * Email por procura para UMA lead, a partir da ficha dela.
 *
 * Cruza a procura da lead com a carteira (imóveis + empreendimentos), pede à
 * IA um email personalizado — dirigido a ela, com os imóveis que batem certo —
 * e devolve o RASCUNHO. Nada é enviado daqui: o consultor revê, edita e envia
 * da ficha, e o envio segue pelo /api/smtp/send normal (que regista a
 * interação e o last_contact).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { leadId } = req.body as { leadId?: string };
    if (!leadId) return res.status(400).json({ error: "leadId em falta" });

    // A lead tem de ser visível para quem pede (dono ou atribuída).
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
      .maybeSingle();

    if (!lead) return res.status(404).json({ error: "Lead não encontrada" });
    if (!lead.email) {
      return res.status(400).json({ error: "A lead não tem email registado." });
    }

    // Imóveis da carteira que batem com a procura desta lead.
    const matches = await findMatchesForLead(leadId, undefined, {
      client: supabaseAdmin,
      userId: lead.user_id,
    } as any);

    const topMatches = (matches || []).slice(0, 4);
    if (topMatches.length === 0) {
      return res.status(200).json({
        success: false,
        noMatches: true,
        message:
          "Nenhum imóvel da carteira corresponde à procura desta lead. Completa a qualificação dela ou adiciona imóveis compatíveis.",
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const consultantName = profile?.full_name || "Consultor";

    const matchesText = topMatches
      .map((m: any, i: number) => {
        const p = m.property || m;
        return `${i + 1}. ${p.title || "Imóvel"} — ${[
          p.typology,
          p.city || p.address,
          p.area ? `${p.area} m²` : null,
          p.price ? `${Number(p.price).toLocaleString("pt-PT")} €` : null,
        ]
          .filter(Boolean)
          .join(", ")}${m.score ? ` (compatibilidade ${m.score}%)` : ""}`;
      })
      .join("\n");

    const prompt = `És ${consultantName}, consultor imobiliário. Escreve um email PESSOAL para esta lead concreta — não é uma campanha em massa.

LEAD:
- Nome: ${lead.name}
- Procura: ${[lead.typology, lead.property_type, lead.location_preference ? `em ${lead.location_preference}` : null].filter(Boolean).join(", ") || "não detalhada"}
- Orçamento: ${lead.budget_max ? `até ${Number(lead.budget_max).toLocaleString("pt-PT")} €` : "não indicado"}
- Objetivo: ${lead.buy_purpose || "não indicado"}

IMÓVEIS DA CARTEIRA QUE CORRESPONDEM À PROCURA DELA:
${matchesText}

REGRAS:
- Português de Portugal, tom próximo mas profissional. Máximo 150 palavras.
- Dirige-te à lead pelo primeiro nome. Mostra que conheces a procura DELA.
- Apresenta os imóveis pelo que têm de relevante para ela — não listes fichas técnicas.
- Termina com um convite claro para responder ou agendar uma visita.
- NÃO inventes características que não estão nos dados acima.

Responde APENAS com JSON: {"subject": "...", "html": "<p>...</p>"}`;

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_search_email",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.6,
    });

    let draft: { subject?: string; html?: string } = {};
    try {
      const cleaned = aiResponse.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      draft = JSON.parse(cleaned.substring(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    } catch {
      return res.status(500).json({ error: "A IA devolveu um formato inesperado. Tenta novamente." });
    }

    if (!draft.subject || !draft.html) {
      return res.status(500).json({ error: "O rascunho veio incompleto. Tenta novamente." });
    }

    return res.status(200).json({
      success: true,
      subject: draft.subject,
      html: draft.html,
      matches: topMatches.map((m: any) => ({
        title: (m.property || m).title,
        score: m.score ?? null,
      })),
    });
  } catch (error: any) {
    console.error("[search-email-draft]", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar o email." });
  }
}
