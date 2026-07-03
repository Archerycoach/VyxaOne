import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { calculateHistoricalConversionRates, calculateConversionProbability } from "@/services/predictiveScoringService";

/**
 * Cron Job: Scoring Preditivo de Leads
 *
 * Recalcula diariamente a probabilidade de fecho de todas as leads ativas,
 * com base no histórico real de negócios fechados (e perdidos) de cada
 * consultor — origem, escalão de orçamento, objetivo da compra. Só corre
 * para consultores com histórico suficiente (10+ leads com desfecho
 * definido) para os números serem minimamente fiáveis.
 *
 * Configurado no vercel.json para executar diariamente.
 */

const MIN_HISTORICAL_LEADS = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Predictive Scoring] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Predictive Scoring] Starting at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = { usersProcessed: 0, leadsUpdated: 0, usersSkippedNoData: 0, errors: 0 };

  try {
    const { data: userIdsData } = await supabaseAdmin
      .from("leads")
      .select("user_id")
      .not("follow_up_state", "in", '("archived","opt_out")');

    const userIds = Array.from(new Set(((userIdsData || []) as { user_id: string }[]).map((r) => r.user_id)));

    for (const userId of userIds) {
      try {
        const rates = await calculateHistoricalConversionRates(userId, supabaseAdmin as any);
        const totalHistorical = Object.values(rates.bySource).reduce((sum, s) => sum + s.sampleSize, 0);

        if (totalHistorical < MIN_HISTORICAL_LEADS) {
          results.usersSkippedNoData++;
          continue;
        }

        const { data: activeLeads } = await supabaseAdmin
          .from("leads")
          .select("id, source, budget_max, buy_purpose")
          .eq("user_id", userId)
          .not("status", "in", '("won","lost")')
          .not("follow_up_state", "in", '("archived","opt_out")');

        for (const lead of (activeLeads || []) as any[]) {
          const result = calculateConversionProbability(lead, rates);
          await (supabaseAdmin.from("leads") as any)
            .update({
              conversion_probability: result.hasEnoughData ? result.probability : null,
              conversion_probability_factors: result.factors,
              conversion_probability_updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id);
          results.leadsUpdated++;
        }

        results.usersProcessed++;
      } catch (userError) {
        console.error(`[Predictive Scoring] Erro ao processar utilizador ${userId}:`, userError);
        results.errors++;
      }
    }

    console.log("[Predictive Scoring] Concluído:", JSON.stringify(results));
    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("[Predictive Scoring] Erro:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
