import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateMatchScore } from "@/services/matchingService";

/**
 * Cruza um imóvel de particular com a carteira de compradores do consultor.
 *
 * É aqui que está o valor da funcionalidade: o consultor liga ao proprietário
 * já a saber quantos (e quais) compradores seus encaixam naquele imóvel.
 * Usa exclusivamente dados do próprio consultor.
 */

// Fases que significam "acabou" — tudo o resto conta como comprador ativo.
// Whitelist de fases ativas seria frágil: as fases do pipeline são
// configuráveis e variam entre instalações.
const CLOSED_STATUSES = new Set([
  "won", "lost", "fechado", "perdido", "vendido", "ganho", "descartado",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { prospectId, prospect, minScore } = req.body as {
    prospectId?: string;
    prospect?: Record<string, unknown>;
    minScore?: number;
  };

  try {
    // O imóvel pode vir já gravado (prospectId) ou ainda por gravar (prospect).
    let target: Record<string, unknown> | null = prospect || null;

    if (prospectId) {
      const { data } = await (supabaseAdmin as any)
        .from("fsbo_prospects")
        .select("*")
        .eq("id", prospectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) return res.status(404).json({ error: "Imóvel não encontrado" });
      target = data;
    }

    if (!target) {
      return res.status(400).json({ error: "Indica o imóvel a cruzar." });
    }

    // Compradores do consultor que ainda estão em jogo.
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .neq("lead_type", "seller")
      .is("archived_at", null)
      .limit(300);

    const activeBuyers = (leads || []).filter(
      (lead: any) => !CLOSED_STATUSES.has(String(lead.status || "").toLowerCase())
    );

    const threshold = typeof minScore === "number" ? minScore : 60;

    const matches = activeBuyers
      .map((lead: any) => {
        const { score, reasons } = calculateMatchScore(lead, target, "internal");
        return {
          leadId: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          temperature: lead.temperature,
          score,
          reasons,
        };
      })
      .filter((m) => m.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Guarda a contagem, para a lista mostrar sem recalcular tudo.
    if (prospectId) {
      await (supabaseAdmin as any)
        .from("fsbo_prospects")
        .update({ matched_buyers: matches.length, updated_at: new Date().toISOString() })
        .eq("id", prospectId)
        .eq("user_id", user.id);
    }

    return res.status(200).json({
      success: true,
      total: matches.length,
      buyersConsidered: activeBuyers.length,
      matches,
    });
  } catch (error: any) {
    console.error("[fsbo/match] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao cruzar com a carteira." });
  }
}
