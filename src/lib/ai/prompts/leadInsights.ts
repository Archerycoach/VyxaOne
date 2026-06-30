interface LeadInsightsContext {
  leadData: any;
  interactionsHistory: any[];
  notesHistory: any[];
}

export function getLeadInsightsPrompt(context: LeadInsightsContext): string {
  return `És um assistente especializado em vendas imobiliárias. Analisa esta lead e devolve uma análise acionável em JSON.

DADOS DA LEAD:
${JSON.stringify(context.leadData, null, 2)}

HISTÓRICO DE INTERAÇÕES:
${JSON.stringify(context.interactionsHistory, null, 2)}

NOTAS REGISTADAS:
${JSON.stringify(context.notesHistory, null, 2)}

Analisa o estado da relação com esta lead, o sentimento demonstrado e o que falta para avançar para a conversão.

Responde APENAS em JSON válido, com EXATAMENTE esta estrutura (sem texto antes ou depois):
{
  "summary": "resumo curto (2-3 frases) do estado atual da lead e do seu potencial de conversão",
  "sentiment": "positivo" | "neutro" | "negativo",
  "temperature": "hot" | "warm" | "cold",
  "next_best_action": "a próxima melhor ação concreta que o consultor deve tomar",
  "pain_points": ["preocupação ou obstáculo 1", "preocupação 2"]
}

Regras:
- "sentiment" reflete a atitude/recetividade da lead nas interações.
- "temperature": "hot" se está perto de converter, "warm" se há interesse mas falta avançar, "cold" se está parada ou pouco recetiva.
- "pain_points": lista as objeções, dúvidas ou obstáculos reais da lead (ou [] se não houver sinais).
- Escreve em português de Portugal, de forma direta e útil para o consultor.`;
}