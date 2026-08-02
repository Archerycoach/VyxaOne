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
  /**
   * Link do anúncio. Serve para o consultor abrir o comparável na aplicação —
   * NUNCA vai para o PDF (é um documento entregue ao cliente, e a fonte dos
   * comparáveis não deve lá constar).
   */
  url?: string | null;
  /** Estado de conservação lido do anúncio. */
  conditionLabel?: string | null;
  /** Imagem de destaque do anúncio (URL) e a mesma em data URI para o PDF. */
  thumbnail?: string | null;
  thumbnailDataUri?: string | null;
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
  /** Equipamento de eficiência energética — cada vez mais valorizado. */
  hasSolarPanels?: boolean | null;
  hasHeatPump?: boolean | null;
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
  freguesia?: string | null;
  concelho?: string | null;
  distrito?: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  condition: string | null;
  factors?: PropertyValueFactors;
  comparables: ComparableSummary[];
  /** Mediana de €/m² da oferta na zona, independente dos comparáveis. */
  zonePricePerSqm?: number | null;
  zoneSampleSize?: number | null;
  /** Frase sobre o ajuste do terreno, quando aplicado. */
  landAdjustmentNote?: string | null;
  /** Desdobramento dos ajustes por características, já calculado. */
  factorNote?: string | null;
  /** Texto livre do consultor sobre o imóvel (viu-o; a IA não). */
  consultantDescription?: string | null;
  /** Valor mediano de escrituras do INE, quando disponível. */
  inePricePerSqm?: number | null;
  /** Geografia do valor INE (freguesia quando publicada, senão concelho). */
  ineGeoName?: string | null;
  /** Evolução homóloga (%) da mediana de escrituras do concelho. */
  ineTrendYoyPct?: number | null;
  /** Renda mediana €/m² de novos contratos (INE), quando disponível. */
  ineRentPerSqm?: number | null;
  /** Yield bruta estimada (%) ao valor recomendado. */
  grossYieldPct?: number | null;
  /** €/m² pedido nos anúncios, para contrastar com o que se paga. */
  askingPricePerSqm?: number | null;
  /** Quanto o mercado PEDE acima (ou abaixo) do que PAGA, em %. */
  askingVsSoldGapPct?: number | null;
  soldAvgPricePerSqm: number | null;
  activeAvgPricePerSqm: number | null;
  suggestedMin: number | null;
  suggestedMax: number | null;
  /** Estimativa por estado de conservação (A/B/C), quando disponível. */
  scenarios?: Array<{
    label: string;
    pricePerSqmMin: number;
    pricePerSqmMax: number;
    valueMin: number;
    valueMax: number;
  }> | null;
  /** Validação pelo VPT (3,3–3,8×), quando o VPT foi indicado. */
  vptCrossCheck?: {
    vpt: number;
    multipleMin: number;
    multipleMax: number;
    valueMin: number;
    valueMax: number;
  } | null;
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
  yes("painéis solares", factors.hasSolarPanels);
  yes("bomba de calor", factors.hasHeatPump);

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
    .map((c) => `- [${c.status === "sold" ? "VENDIDO" : "ATIVO"}, ${c.source}] ${c.address} — ${c.area ? `${c.area} m²` : "área desconhecida"}, ${c.price ? `${c.price.toLocaleString("pt-PT")}€` : "preço desconhecido"}${c.pricePerSqm ? ` (${Math.round(c.pricePerSqm)}€/m²)` : ""}${c.conditionLabel ? ` — ${c.conditionLabel}` : ""}`)
    .join("\n");

  return `És ${context.consultantName}, um consultor imobiliário a preparar uma Avaliação Comparativa de Mercado (CMA) para apresentar ao proprietário de um imóvel, como parte da angariação.

IMÓVEL A AVALIAR:
- Morada: ${context.address}
- Freguesia / Concelho / Distrito: ${[context.freguesia, context.concelho, context.distrito].filter(Boolean).join(" / ") || "não indicados"}
- Tipo: ${context.propertyType}
- Área: ${context.area ? `${context.area} m²` : "não indicada"}
- Tipologia: ${context.bedrooms ? `T${context.bedrooms}` : "não indicada"}${context.bathrooms ? `, ${context.bathrooms} casas de banho` : ""}
- Estado de conservação: ${context.condition || "não indicado"}
- Ano de construção: ${context.factors?.yearBuilt || "não indicado"}
- Valor Patrimonial Tributário (VPT): ${context.vptCrossCheck ? `${context.vptCrossCheck.vpt.toLocaleString("pt-PT")}€` : "não indicado"}
- CARACTERÍSTICAS COM IMPACTO NO VALOR: ${describeValueFactors(context.factors)}

IMÓVEIS COMPARÁVEIS ENCONTRADOS:
${comparablesList || "Nenhum comparável direto encontrado na zona."}

DADOS JÁ CALCULADOS (usa estes valores exatamente, não inventes outros):
- Preço médio/m² de imóveis VENDIDOS na zona: ${context.soldAvgPricePerSqm ? `${Math.round(context.soldAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
${context.inePricePerSqm ? `- Valor MEDIANO DE ESCRITURAS (INE, dados oficiais${context.ineGeoName ? `, ${context.ineGeoName}` : ""}): ${Math.round(context.inePricePerSqm)}€/m² — ÂNCORA de realismo (preços efetivamente pagos), com transações refletidas com algum atraso, por isso tende a subavaliar submercados centrais/valorizados. A recomendação apoia-se sobretudo nos COMPARÁVEIS locais (mesma zona, área e tipologia semelhantes), usando o INE para não descolar da realidade — não como o valor principal.
` : ""}${context.ineTrendYoyPct !== null && context.ineTrendYoyPct !== undefined ? `- TENDÊNCIA DO MERCADO (INE, concelho): a mediana de escrituras variou ${context.ineTrendYoyPct > 0 ? "+" : ""}${context.ineTrendYoyPct}% face ao período homólogo — usa isto no enquadramento de mercado (secção 2).
` : ""}${context.ineRentPerSqm ? `- RENDAS (INE): a renda mediana de novos contratos no concelho é ${context.ineRentPerSqm.toFixed(2).replace(".", ",")}€/m²/mês${context.grossYieldPct ? `, o que ao valor recomendado equivale a uma yield bruta estimada de ~${String(context.grossYieldPct).replace(".", ",")}%/ano (antes de impostos e encargos) — relevante se o comprador-alvo for investidor` : ""}.
` : ""}- Valor de referência da ZONA: ${context.zonePricePerSqm ? `${Math.round(context.zonePricePerSqm)}€/m² (mediana de ${context.zoneSampleSize} imóveis à venda na zona, independentemente de área ou tipologia)` : "sem dados suficientes"}
- Preço médio/m² de imóveis ATIVOS (à venda) na zona: ${context.activeAvgPricePerSqm ? `${Math.round(context.activeAvgPricePerSqm)}€/m²` : "sem dados suficientes"}
${context.landAdjustmentNote ? `- Terreno: ${context.landAdjustmentNote}
` : ""}${context.factorNote ? `- Ajustes por características (já refletidos no intervalo): ${context.factorNote}
` : ""}${context.consultantDescription ? `- DESCRIÇÃO DO CONSULTOR (esteve no imóvel; usa-a na análise): ${context.consultantDescription}
` : ""}${
  context.askingVsSoldGapPct !== null && context.askingVsSoldGapPct !== undefined && context.askingPricePerSqm
    ? `- DIFERENÇA PEDIDO vs PAGO: os anúncios da zona pedem ${Math.round(context.askingPricePerSqm)}€/m², mas as escrituras fecham a ${Math.round(context.inePricePerSqm || 0)}€/m² — uma diferença de ${context.askingVsSoldGapPct > 0 ? "+" : ""}${context.askingVsSoldGapPct}%
`
    : ""
}- Intervalo de valor sugerido: ${context.suggestedMin && context.suggestedMax ? `${context.suggestedMin.toLocaleString("pt-PT")}€ — ${context.suggestedMax.toLocaleString("pt-PT")}€` : "sem dados suficientes para sugerir"}
${
  context.scenarios && context.scenarios.length > 0
    ? `- ESTIMATIVA POR ESTADO DE CONSERVAÇÃO (posicionamento de mercado): ${context.scenarios.map((s) => `${s.label} ${s.pricePerSqmMin.toLocaleString("pt-PT")}–${s.pricePerSqmMax.toLocaleString("pt-PT")}€/m² (${s.valueMin.toLocaleString("pt-PT")}–${s.valueMax.toLocaleString("pt-PT")}€)`).join("; ")}. O salto entre cenários é o potencial de valorização por obras.
`
    : ""
}${
  context.vptCrossCheck
    ? `- VALIDAÇÃO PELO VPT: o valor patrimonial tributário é ${context.vptCrossCheck.vpt.toLocaleString("pt-PT")}€; na Área Metropolitana de Lisboa o valor de mercado ronda ${context.vptCrossCheck.multipleMin}–${context.vptCrossCheck.multipleMax}× o VPT, o que dá ${context.vptCrossCheck.valueMin.toLocaleString("pt-PT")}–${context.vptCrossCheck.valueMax.toLocaleString("pt-PT")}€ — usa isto como CONFIRMAÇÃO oficial do intervalo, não como o valor principal.
`
    : ""
}
O teu objetivo: escreve um relatório em HTML limpo e profissional (usa h3, p, ul, li — nunca h1/h2, nunca markdown) com estas secções.

REGRAS DE ESCRITA (tão importantes como o conteúdo):
- SÊ SINTÉTICO. Apesar das 7 secções, o relatório inteiro não deve passar das 650 palavras. Cada secção é curta e direta; um proprietário lê um documento bem organizado, não três páginas de texto corrido.
- Parágrafos CURTOS: no máximo 3 frases cada. Nunca um parágrafo com mais de 60 palavras.
- Nas secções de comparáveis e de fatores, usa LISTAS (ul/li) em vez de texto corrido. Cada item numa linha, direto ao ponto.
- NÃO repitas números que já aparecem nas tabelas e nos cartões do documento. Interpreta-os, não os recites.
- Escolhe os 3 ou 4 comparáveis que realmente informam a decisão; não comentes todos um a um.
- Evita fórmulas vazias ("importa sublinhar que", "neste momento", "de referir que"). Vai direto ao facto.

SECÇÕES (usa <h3> para o título de CADA uma, com o NÚMERO no início — ex.: <h3>1. Identificação do imóvel</h3> —, exatamente estas 7 e por esta ordem):
1. "Identificação do imóvel" — 2-3 frases factuais: morada, freguesia/concelho/distrito, tipo, tipologia, área e ano de construção; e o VPT quando indicado. Sem interpretação.
2. "Enquadramento do mercado local" — o €/m² de referência da zona/freguesia, a TENDÊNCIA homóloga do INE quando disponível (ex.: "o mercado do concelho valorizou X% no último ano"), a renda mediana/yield quando disponível, e o caráter da zona (centralidade, comércio e transportes de proximidade, idade do parque habitacional se o ano de construção o sugerir). 2-4 frases.
3. "Comparáveis de mercado" — EM LISTA. Comenta em UMA linha cada um dos melhores comparáveis (mesma tipologia ou adjacente, área semelhante): tipologia, área, €/m² e uma observação de estado (renovado / intermédio / a necessitar de obras). IDENTIFICA e EXCLUI explicitamente os OUTLIERS (gama alta, duplex, fortemente remodelados) do cálculo da média — di-lo. Refere diferenças (elevador, andar, estado) que expliquem desvios de €/m² entre imóveis de área semelhante.
4. "Metodologia e cálculo" — EM LISTA, as três abordagens independentes que sustentam o valor: (a) comparativo pela ZONA/freguesia (€/m² de referência × área); (b) comparativo DIRETO (média dos comparáveis, excluindo outliers); (c) múltiplo do VPT (3,3–3,8× o VPT, típico na Área Metropolitana de Lisboa) — só quando há VPT. Uma linha por método, com o valor a que cada um chega.
5. "Valor de mercado estimado" — apresenta o INTERVALO recomendado (os números já calculados acima, NÃO os alteres) e o ponto médio. Liga aos CENÁRIOS de conservação: onde o imóvel se posiciona conforme o estado e o potencial de valorização por obras (o salto do cenário A para o C). Se existir a diferença PEDIDO vs PAGO, explica em 1-2 frases o que a margem significa (o anúncio não é a escritura; anunciar acima do que o mercado paga arrasta o tempo de venda e o desconto final).
6. "Notas e limitações" — EM LISTA, honesto e profissional: é uma estimativa indicativa a partir de dados públicos de mercado e da caderneta, NÃO uma avaliação pericial certificada nem bancária; não houve visita ao imóvel, pelo que os valores devem ser confirmados presencialmente; os preços dos portais são valores PEDIDOS (tipicamente reduzidos 3–8% na negociação até à escritura); o VPT serve fins fiscais (IMI/IMT) e não reflete o valor de mercado; para crédito habitação, escritura, partilha ou litígio, recomenda-se avaliação formal por perito avaliador certificado.
7. "Fontes" — EM LISTA curta: Caderneta Predial Urbana (quando usada), relatório de preços do Idealista (concelho/freguesia), anúncios do Idealista, e mediana de escrituras do INE.

Responde EXCLUSIVAMENTE com o código HTML final do relatório.`;
}
