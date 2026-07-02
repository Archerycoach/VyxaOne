interface PerformanceCoachSummaryContext {
  consultantName: string;
  annualRevenuePercentage: number | null;
  semesterRevenuePercentage: number | null;
  conversionRate: number;
  totalActiveLeads: number;
  bottleneckStageLabel: string | null;
  bottleneckStageCount: number;
  leadsNeededPerWeek: number | null;
}

/**
 * Prompt leve para o Coach de Performance: todas as métricas (progresso de
 * metas, taxa de conversão, gargalo do funil, ritmo necessário) já vêm
 * calculadas de forma determinística pelo endpoint — a IA só traduz isso num
 * conselho curto, direto e acionável, sem inventar números.
 */
export function getPerformanceCoachSummaryPrompt(context: PerformanceCoachSummaryContext): string {
  return `És um coach de performance direto e experiente, especializado em consultores imobiliários. Aqui estão os números reais de ${context.consultantName} este período:

- Progresso da meta de faturação (semestre): ${context.semesterRevenuePercentage !== null ? `${context.semesterRevenuePercentage}%` : "sem meta definida"}
- Progresso da meta de faturação (ano): ${context.annualRevenuePercentage !== null ? `${context.annualRevenuePercentage}%` : "sem meta definida"}
- Taxa de conversão (leads → negócio fechado): ${context.conversionRate}%
- Leads ativas no funil: ${context.totalActiveLeads}
- Fase com mais leads paradas: ${context.bottleneckStageLabel ? `${context.bottleneckStageLabel} (${context.bottleneckStageCount} leads)` : "sem gargalo evidente"}
- Ritmo necessário para bater a meta: ${context.leadsNeededPerWeek !== null ? `aproximadamente ${context.leadsNeededPerWeek} novas leads qualificadas por semana` : "sem meta definida para calcular"}

Escreve um conselho de 2-3 frases, direto, honesto e sem rodeios (nem elogios vazios nem alarmismo), em português de Portugal. Aponta CLARAMENTE a UMA coisa em que se deve focar esta semana com base nestes números — não repitas todos os números, escolhe o mais importante. Responde APENAS com o texto do conselho, sem markdown nem aspas.`;
}
