interface LeadInsightsContext {
  leadData: any;
  interactionsHistory: any[];
  notesHistory: any[];
}

export function getLeadInsightsPrompt(context: LeadInsightsContext): string {
  return `Analisa esta lead imobiliária e fornece insights acionáveis em formato JSON.

DADOS DA LEAD:
${JSON.stringify(context.leadData, null, 2)}

HISTÓRICO DE INTERAÇÕES:
${JSON.stringify(context.interactionsHistory, null, 2)}

NOTAS REGISTADAS:
${JSON.stringify(context.notesHistory, null, 2)}

Responde APENAS em JSON com a seguinte estrutura:
{
  "lead_quality_score": number (0-100),
  "temperature_suggestion": "hot" | "warm" | "cold",
  "next_action": "string descrevendo a próxima ação recomendada",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "red_flags": ["flag 1", "flag 2"] ou [],
  "opportunities": ["oportunidade 1", "oportunidade 2"] ou []
}`;
}