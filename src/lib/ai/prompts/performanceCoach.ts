interface PerformanceCoachContext {
  funnelCounts: Record<string, number>;
  totalLeads: number;
  wonDealsCount: number;
  conversionRate: string;
}

export function getPerformanceCoachPrompt(context: PerformanceCoachContext): {
  system: string;
  user: string;
} {
  const systemPrompt = `És um 'Coach de Performance' implacável e experiente em imobiliário.
Analisa os dados do consultor.
Regras:
1. Faz uma avaliação rápida da taxa de conversão (Leads totais vs Negócios fechados).
2. Se a taxa for baixa (<3%), alerta para o facto de não estar a qualificar bem os leads. Se for >10%, elogia o fecho.
3. Dá 2 ou 3 conselhos muito matemáticos e preditivos. Exemplo: "Com base no teu funil (onde tens muitos em 'proposta'), deves focar-te em fazer 5 chamadas de fecho hoje."
4. Mantém a resposta concisa, agressivamente focada em resultados e produtividade. Não divagues.
5. Formata com parágrafos claros.`;

  const userPrompt = `O meu funil atual: ${JSON.stringify(context.funnelCounts)}
Leads Totais no sistema: ${context.totalLeads}
Negócios ganhos: ${context.wonDealsCount}
Taxa de conversão atual calculada: ${context.conversionRate}%

Diz-me a verdade sobre o meu funil e onde preciso de focar esforços esta semana.`;

  return { system: systemPrompt, user: userPrompt };
}