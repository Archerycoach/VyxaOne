interface ComparableSummary {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  pricePerSqm: number | null;
  price: number | null;
  /** Características do comparável, para justificar diferenças de preço. */
  features?: string[];
  energyRating?: string | null;
  yearBuilt?: number | null;
  floor?: number | null;
}

/**
 * Atributos que influenciam materialmente o valor de um imóvel e que a
 * avaliação anterior ignorava por completo — só olhava para área, tipologia e
 * estado de conservação.
 *
 * Na prática, dois T2 com a mesma área na mesma rua podem diferir 15-20% em
 * preço consoante tenham elevador, garagem, varanda ou vista. Sem estes
 * dados, a avaliação atribui a diferença a "variação de mercado" e perde
 * credibilidade junto do proprietário.
 */
export interface PropertyValueFactors {
  hasElevator?: boolean | null;
  hasGarage?: boolean | null;
  parkingSpaces?: number | null;
  hasBalcony?: boolean | null;
  hasTerrace?: boolean | null;
  hasGarden?: boolean | null;
  hasPool?: boolean | null;
  hasStorage?: boolean | null;
  hasAirConditioning?: boolean | null;
  hasSeaView?: boolean | null;
  floor?: number | null;
  totalFloors?: number | null;
  energyRating?: string | null;
  yearBuilt?: number | null;
  landArea?: number | null;
  /** Outras características em texto livre (features/amenities do imóvel). */
  otherFeatures?: string[];
}

interface CmaReportContext {
  consultantName: string;
  address: string;
  propertyType: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  condition: string | null;
  factors?: PropertyValueFactors;
  comparables: ComparableSummary[];
  soldAvgPricePerSqm: number | null;
  activeAvgPricePerSqm: number | null;
  suggestedMin: number | null;
  suggestedMax: number | null;
}

/** Descreve os atributos de valor em texto legível para o prompt. */
export function describeValueFactors(factors?: PropertyValueFactors): string {
  if (!factors) return "não indicados";

  const parts: string[] = [];
  const yes = (label: string, value: boolean | null | undefined) => {
    if (value === true) parts.push(label);
  };

  yes("elevador", factors.hasElevator);
  if (factors.hasGarage || (factors.parkingSpaces && factors.parkingSpaces > 0)) {
    parts.push(
      factors.parkingSpaces && factors.parkingSpaces > 0
        ? `garagem/estacionamento (${factors.parkingSpaces} lugar${factors.parkingSpaces > 1 ? "es" : ""})`
        : "garagem/estacionamento"
    );
  }
  yes("varanda", factors.hasBalcony);
  yes("terraço", factors.hasTerrace);
  yes("jardim", factors.hasGarden);
  yes("piscina", factors.hasPool);
  yes("arrecadação", factors.hasStorage);
  yes("ar condicionado", factors.hasAirConditioning);
  yes("vista mar", factors.hasSeaView);

  if (factors.floor !== null && factors.floor !== undefined) {
    parts.push(
      `${factors.floor}º andar${factors.totalFloors ? ` de ${factors.totalFloors}` : ""}` +
        (factors.floor === 0 ? " (rés do chão)" : "")
    );
  }
  if (factors.energyRating) parts.push(`classe energética ${factors.energyRating}`);
  if (factors.yearBuilt) parts.push(`construído em ${factors.yearBuilt}`);
  if (factors.landArea) parts.push(`terreno de ${factors.landArea} m²`);
  if (factors.otherFeatures?.length) parts.push(...factors.otherFeatures);

  // Ausências que PESAM no valor: dizer que não tem elevador num 4.º andar é
  // tão relevante para a avaliação como dizer que tem.
  const missing: string[] = [];
  if (factors.hasElevator === false && (factors.floor ?? 0) >= 2) {
    missing.push("SEM elevador (relevante neste andar)");
  }
  if (factors.hasGarage === false && !factors.parkingSpaces) {
    missing.push("sem lugar de estacionamento");
  }

  const all = [...parts, ...missing];
  return all.length > 0 ? all.join(", ") : "não indicados";
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
- CARACTERÍSTICAS COM IMPACTO NO VALOR: ${describeValueFactors(context.factors)}

IMÓVEIS COMPARÁVEIS ENCONTRADOS:
${comparablesList || "Nenhum comparável direto encontrado na zona."}

DADOS JÁ CALCULADOS (usa estes valores exatamente, não inventes outros):
- Preço médio/m² de imóveis VENDIDOS na zona: ${context.soldAvgPricePerSqm ? `${Math.round(context.soldAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
- Preço médio/m² de imóveis ATIVOS (à venda) na zona: ${context.activeAvgPricePerSqm ? `${Math.round(context.activeAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
- Intervalo de valor sugerido: ${context.suggestedMin && context.suggestedMax ? `${context.suggestedMin.toLocaleString("pt-PT")}€ — ${context.suggestedMax.toLocaleString("pt-PT")}€` : "sem dados suficientes para sugerir"}

O teu objetivo: escreve um relatório em HTML limpo e profissional (usa h3, p, ul, li — nunca h1/h2, nunca markdown) com estas secções.

REGRAS DE ESCRITA (tão importantes como o conteúdo):
- SÊ SINTÉTICO. O relatório inteiro não deve passar das 450 palavras. Um proprietário lê um documento curto e bem organizado; não lê três páginas de texto corrido.
- Parágrafos CURTOS: no máximo 3 frases cada. Nunca um parágrafo com mais de 60 palavras.
- Nas secções de comparáveis e de fatores, usa LISTAS (ul/li) em vez de texto corrido. Cada item numa linha, direto ao ponto.
- NÃO repitas números que já aparecem nas tabelas e nos cartões do documento. Interpreta-os, não os recites.
- Escolhe os 3 ou 4 comparáveis que realmente informam a decisão; não comentes todos um a um.
- Evita fórmulas vazias ("importa sublinhar que", "neste momento", "de referir que"). Vai direto ao facto.

SECÇÕES:
1. Um parágrafo de abertura (máximo 3 frases) a contextualizar o mercado na zona.
2. "Análise de Comparáveis" — EM LISTA. Explica o que os comparáveis mostram, distinguindo o peso de imóveis VENDIDOS (preço real) vs ATIVOS (preço pedido, pode estar inflacionado). Sempre que um comparável tenha características diferentes das do imóvel (elevador, garagem, varanda, andar, classe energética), REFERE essa diferença ao comparar preços — é o que explica desvios de €/m² entre imóveis semelhantes em área.
3. "Fatores de Valorização" — EM LISTA, separando o que valoriza do que desvaloriza. Como as características influenciam o valor face aos comparáveis:
   - VALORIZAM: elevador, garagem/estacionamento, varanda/terraço, arrecadação, boa classe energética (A/B), andar alto com vista, construção recente.
   - DESVALORIZAM: ausência de elevador em andares altos, rés-do-chão sem exterior, classe energética fraca (E/F), necessidade de obras.
   - Sê concreto e honesto: se o imóvel tem pontos fracos, di-lo — o proprietário vai confrontar-se com eles na negociação, e um relatório que os omite perde credibilidade.
   - Se as características não foram indicadas, diz que a avaliação ganharia precisão com esses dados. NUNCA assumas que existem.
4. "Valor Recomendado" — apresenta o intervalo sugerido (os números já calculados acima, não os alteres) e justifica-o com base na análise dos comparáveis E dos fatores de valorização.
5. Um parágrafo final (máximo 3 frases), profissional e transparente, que reforça a recomendação sem soar a argumento de venda agressivo.

Responde EXCLUSIVAMENTE com o código HTML final do relatório.`;
}
