import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getPerformanceCoachSummaryPrompt } from "@/lib/ai/prompts/performanceCoach";

/**
 * Coach de Performance — reconstruído para calcular as métricas de forma
 * determinística (progresso de metas, taxa de conversão, gargalo do funil,
 * ritmo necessário para bater os objetivos), tal como o hub "O Meu Dia"
 * (src/pages/api/gpt/agents/organizer.ts). A IA só gera um conselho curto
 * com base nos números já calculados — nunca inventa métricas.
 */

// Ordem esperada do funil, do início ao fecho. Usada só para identificar a
// fase com mais leads atualmente à espera de avançar (não é um verdadeiro
// funil de conversão histórico, já que não há registo de quanto tempo cada
// lead passou em cada fase — ver src/pages/api/leads/run-automations.ts e o
// gatilho "pipeline_stage_changed" para uma futura evolução com histórico).
const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: "new", label: "Novo" },
  { key: "contacted", label: "Contactado" },
  { key: "qualified", label: "Qualificado" },
  { key: "proposal", label: "Proposta" },
  { key: "negotiation", label: "Negociação" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentSemester = currentMonth <= 6 ? 1 : 2;

    const semesterStart = new Date(currentYear, currentSemester === 1 ? 0 : 6, 1);
    const yearStart = new Date(currentYear, 0, 1);

    const [leadsResult, dealsResult, goalsResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("status")
        .eq("user_id", user.id)
        .is("archived_at", null),
      supabaseAdmin
        .from("deals")
        .select("amount, transaction_date")
        .eq("user_id", user.id),
      supabaseAdmin
        .from("goals")
        .select("*")
        .eq("goal_type", "individual")
        .eq("user_id", user.id)
        .eq("year", currentYear),
      supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

    const leads = leadsResult.data || [];
    const deals = dealsResult.data || [];
    const goals = (goalsResult.data || []) as any[];

    const annualGoal = goals.find((g) => g.period === "annual");
    const semesterGoal = goals.find((g) => g.period === "semester" && g.semester === currentSemester);

    const dealsThisYear = deals.filter((d) => new Date(d.transaction_date) >= yearStart);
    const dealsThisSemester = deals.filter((d) => new Date(d.transaction_date) >= semesterStart);

    const revenueThisYear = dealsThisYear.reduce((sum, d) => sum + (d.amount || 0), 0);
    const revenueThisSemester = dealsThisSemester.reduce((sum, d) => sum + (d.amount || 0), 0);

    const annualRevenueTarget: number | null = annualGoal?.revenue_target || null;
    const semesterRevenueTarget: number | null = semesterGoal?.revenue_target || null;

    const annualRevenuePercentage = annualRevenueTarget ? Math.round((revenueThisYear / annualRevenueTarget) * 100) : null;
    const semesterRevenuePercentage = semesterRevenueTarget ? Math.round((revenueThisSemester / semesterRevenueTarget) * 100) : null;

    const annualAcquisitionsTarget: number | null = annualGoal?.acquisitions_target || null;
    const semesterAcquisitionsTarget: number | null = semesterGoal?.acquisitions_target || null;

    // Funil: contagem de leads ativas por fase (excluindo won/lost)
    const funnelCounts: Record<string, number> = {};
    for (const lead of leads) {
      const status = (lead as any).status as string;
      funnelCounts[status] = (funnelCounts[status] || 0) + 1;
    }

    const totalActiveLeads = FUNNEL_STAGES.reduce((sum, stage) => sum + (funnelCounts[stage.key] || 0), 0);
    const wonCount = funnelCounts["won"] || 0;
    const totalLeadsIncludingWonLost = leads.length;
    const conversionRate = totalLeadsIncludingWonLost > 0 ? Math.round((wonCount / totalLeadsIncludingWonLost) * 1000) / 10 : 0;

    // Gargalo: fase (excluindo "Novo", já que é normal ter muitas leads ali)
    // com mais leads atualmente à espera de avançar.
    let bottleneck: { key: string; label: string; count: number } | null = null;
    for (const stage of FUNNEL_STAGES) {
      if (stage.key === "new") continue;
      const count = funnelCounts[stage.key] || 0;
      if (count > 0 && (!bottleneck || count > bottleneck.count)) {
        bottleneck = { key: stage.key, label: stage.label, count };
      }
    }

    // Ritmo necessário: quanto falta da meta do semestre, a dividir pelo
    // valor médio de negócio já fechado, a dividir pela taxa de conversão
    // atual, distribuído pelas semanas que faltam do semestre.
    let leadsNeededPerWeek: number | null = null;
    if (semesterRevenueTarget && semesterRevenueTarget > revenueThisSemester && conversionRate > 0) {
      const remainingRevenue = semesterRevenueTarget - revenueThisSemester;
      const avgDealSize = dealsThisSemester.length > 0 ? revenueThisSemester / dealsThisSemester.length : (dealsThisYear.length > 0 ? revenueThisYear / dealsThisYear.length : null);
      if (avgDealSize && avgDealSize > 0) {
        const dealsNeeded = remainingRevenue / avgDealSize;
        const leadsNeeded = dealsNeeded / (conversionRate / 100);
        const semesterEnd = new Date(currentYear, currentSemester === 1 ? 5 : 11, 30);
        const weeksRemaining = Math.max(1, Math.ceil((semesterEnd.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        leadsNeededPerWeek = Math.ceil(leadsNeeded / weeksRemaining);
      }
    }

    const consultantName = (profileResult.data as { full_name?: string } | null)?.full_name?.split(" ")[0] || "Consultor";

    let summary = "";
    try {
      const prompt = getPerformanceCoachSummaryPrompt({
        consultantName,
        annualRevenuePercentage,
        semesterRevenuePercentage,
        conversionRate,
        totalActiveLeads,
        bottleneckStageLabel: bottleneck?.label || null,
        bottleneckStageCount: bottleneck?.count || 0,
        leadsNeededPerWeek,
      });

      const aiResponse = await runAI({
        userId: user.id,
        task: "performance_coach_summary",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        maxTokens: 200,
      });

      summary = aiResponse.text.trim();
    } catch (aiError) {
      console.error("[Coach] Falha ao gerar conselho IA (não bloqueante):", aiError);
    }

    return res.status(200).json({
      summary,
      annual: {
        revenueTarget: annualRevenueTarget,
        revenueAchieved: revenueThisYear,
        revenuePercentage: annualRevenuePercentage,
        acquisitionsTarget: annualAcquisitionsTarget,
        acquisitionsAchieved: dealsThisYear.length,
      },
      semester: {
        revenueTarget: semesterRevenueTarget,
        revenueAchieved: revenueThisSemester,
        revenuePercentage: semesterRevenuePercentage,
        acquisitionsTarget: semesterAcquisitionsTarget,
        acquisitionsAchieved: dealsThisSemester.length,
      },
      funnelCounts,
      totalActiveLeads,
      conversionRate,
      bottleneck,
      leadsNeededPerWeek,
    });
  } catch (error: any) {
    console.error("Coach Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
