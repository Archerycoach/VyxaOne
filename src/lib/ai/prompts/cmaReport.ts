interface ComparableSummary {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  pricePerSqm: number | null;
  price: number | null;
}

interface CmaReportContext {
  consultantName: string;
  address: string;
  propertyType: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  condition: string | null;
  comparables: ComparableSummary[];
  soldAvgPricePerSqm: number | null;
  activeAvgPricePerSqm: number | null;
  suggestedMin: number | null;
  suggestedMax: number | null;
}

/**
 * Prompt para gerar o texto narrativo de uma Avaliação Comparativa de
 * Mercado (CMA) — pensado para o consultor apresentar ao proprietário como
 * argumento para ganhar a angariação. O preço sugerido já vem calculado
 * deterministicamente (ver src/pages/api/gpt/valuation.ts) — a IA só
 * explica e contextualiza os números, nunca inventa o valor.
 */
export function getCmaReportPrompt(context: CmaReportContext): string {
  const comparablesList = context.comparables
    .map((c) => `- [${c.status === "sold" ? "VENDIDO" : "ATIVO"}, ${c.source}] ${c.address} — ${c.area ? `${c.area} m²` : "área desconhecida"}, ${c.price ? `${c.price.toLocaleString("pt-PT")}€` : "preço desconhecido"}${c.pricePerSqm ? ` (${Math.round(c.pricePerSqm)}€/m²)` : ""}`)
    .join("\n");

  return `És ${context.consultantName}, um consultor imobiliário a preparar uma Avaliação Comparativa de Mercado (CMA) para apresentar ao proprietário de um imóvel, como parte da angariação.

IMÓVEL A AVALIAR:
- Morada: ${context.address}
- Tipo: ${context.propertyType}
- Área: ${context.area ? `${context.area} m²` : "não indicada"}
- Tipologia: ${context.bedrooms ? `T${context.bedrooms}` : "não indicada"}${context.bathrooms ? `, ${context.bathrooms} casas de banho` : ""}
- Estado de conservação: ${context.condition || "não indicado"}

IMÓVEIS COMPARÁVEIS ENCONTRADOS:
${comparablesList || "Nenhum comparável direto encontrado na zona."}

DADOS JÁ CALCULADOS (usa estes valores exatamente, não inventes outros):
- Preço médio/m² de imóveis VENDIDOS na zona: ${context.soldAvgPricePerSqm ? `${Math.round(context.soldAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
- Preço médio/m² de imóveis ATIVOS (à venda) na zona: ${context.activeAvgPricePerSqm ? `${Math.round(context.activeAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
- Intervalo de valor sugerido: ${context.suggestedMin && context.suggestedMax ? `${context.suggestedMin.toLocaleString("pt-PT")}€ — ${context.suggestedMax.toLocaleString("pt-PT")}€` : "sem dados suficientes para sugerir"}

O teu objetivo: escreve um relatório em HTML limpo e profissional (usa h3, p, ul, li — nunca h1/h2, nunca markdown) com estas secções:
1. Um parágrafo de abertura a contextualizar o mercado na zona.
2. "Análise de Comparáveis" — explica o que os comparáveis mostram, distinguindo o peso de imóveis VENDIDOS (preço real) vs ATIVOS (preço pedido, pode estar inflacionado).
3. "Valor Recomendado" — apresenta o intervalo sugerido (os números já calculados acima, não os alteres) e justifica-o com base na análise.
4. Um parágrafo final profissional, transparente, que reforça a tua recomendação sem soar como um argumento de venda agressivo.

Responde EXCLUSIVAMENTE com o código HTML final do relatório.`;
}
