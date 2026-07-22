/**
 * Verificação de sanidade da avaliação.
 *
 * O relatório entregue ao cliente é deliberadamente preso aos dados: a IA não
 * pode inventar valores, e isso torna-o defensável. Mas tem um custo — quando
 * a amostra de comparáveis é má, o documento erra com toda a confiança e
 * ninguém dá por isso.
 *
 * Foi o que aconteceu numa moradia em Mafra: os comparáveis vinham de
 * freguesias rurais vizinhas e de outro segmento, e a avaliação saiu em
 * ~330 000 € quando o valor real ronda os 700 000 €.
 *
 * Esta verificação corre em SEPARADO e aqui a IA PODE usar o que sabe do
 * mercado. O resultado nunca entra no documento do cliente: é um aviso ao
 * consultor, que decide.
 */

export interface SanityCheckContext {
  address: string;
  city?: string | null;
  propertyType: string;
  propertySubtype?: string | null;
  area: number;
  landArea?: number | null;
  bedrooms?: number | null;
  condition?: string | null;
  features?: string[];
  /** O que a avaliação calculou a partir dos dados. */
  computedMin: number | null;
  computedMax: number | null;
  computedPricePerSqm: number | null;
}

export function getMarketSanityCheckPrompt(context: SanityCheckContext): string {
  const caracteristicas = (context.features || []).filter(Boolean).join(", ");

  return `És um avaliador imobiliário sénior com conhecimento do mercado português.

Avalia se a estimativa abaixo é PLAUSÍVEL para este imóvel. Usa o teu conhecimento do mercado — ao contrário do relatório, aqui é isso que se pretende.

IMÓVEL:
- Morada: ${context.address}${context.city ? `, ${context.city}` : ""}
- Tipo: ${context.propertyType}${context.propertySubtype ? ` (${context.propertySubtype})` : ""}
- Área de construção: ${context.area} m²
${context.landArea ? `- Terreno: ${context.landArea} m²\n` : ""}${context.bedrooms ? `- Quartos: ${context.bedrooms}\n` : ""}${context.condition ? `- Estado: ${context.condition}\n` : ""}${caracteristicas ? `- Características: ${caracteristicas}\n` : ""}
ESTIMATIVA CALCULADA PELO SISTEMA:
${
  context.computedMin && context.computedMax
    ? `${context.computedMin.toLocaleString("pt-PT")}€ — ${context.computedMax.toLocaleString("pt-PT")}€${
        context.computedPricePerSqm ? ` (${Math.round(context.computedPricePerSqm)}€/m²)` : ""
      }`
    : "sem estimativa"
}

O QUE PRECISO:
Indica o intervalo de €/m² que consideras realista para ESTE imóvel, nesta localização concreta, e diz se a estimativa do sistema é plausível.

Fatores que costumam ser subestimados por cálculos automáticos e que deves considerar:
- Escassez de tipologia (ex.: moradias térreas têm procura acima da oferta em muitos concelhos)
- Lote muito acima do típico da zona
- Vista, exposição solar, privacidade
- Micro-localização dentro da freguesia (a diferença entre um lugar e outro pode ser de 30%+)

Responde APENAS com JSON:
{
  "expectedMinPerSqm": <número>,
  "expectedMaxPerSqm": <número>,
  "verdict": "plausivel" | "provavelmente_baixa" | "provavelmente_alta",
  "confidence": "alta" | "media" | "baixa",
  "reasoning": "<2-3 frases, em português de Portugal, a explicar o teu intervalo e o que o sistema pode ter falhado>"
}`;
}

export interface SanityCheckResult {
  expectedMinPerSqm: number | null;
  expectedMaxPerSqm: number | null;
  verdict: "plausivel" | "provavelmente_baixa" | "provavelmente_alta" | null;
  confidence: "alta" | "media" | "baixa" | null;
  reasoning: string | null;
  /** Divergência entre o calculado e o esperado, em %. */
  divergencePct: number | null;
}

/** Lê a resposta da IA sem confiar na forma exata. */
export function parseSanityCheck(
  raw: string,
  computedPricePerSqm: number | null
): SanityCheckResult {
  const empty: SanityCheckResult = {
    expectedMinPerSqm: null,
    expectedMaxPerSqm: null,
    verdict: null,
    confidence: null,
    reasoning: null,
    divergencePct: null,
  };

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return empty;

    const parsed = JSON.parse(cleaned.substring(start, end + 1));

    const toNumber = (value: unknown): number | null => {
      const n = typeof value === "number" ? value : Number(value);
      // Fora deste intervalo é erro do modelo, não um preço.
      return Number.isFinite(n) && n >= 200 && n <= 20000 ? n : null;
    };

    const expectedMin = toNumber(parsed.expectedMinPerSqm);
    const expectedMax = toNumber(parsed.expectedMaxPerSqm);

    let divergencePct: number | null = null;
    if (computedPricePerSqm && expectedMin && expectedMax) {
      const expectedMid = (expectedMin + expectedMax) / 2;
      divergencePct = Math.round((computedPricePerSqm / expectedMid - 1) * 100);
    }

    const verdicts = ["plausivel", "provavelmente_baixa", "provavelmente_alta"];
    const confidences = ["alta", "media", "baixa"];

    return {
      expectedMinPerSqm: expectedMin,
      expectedMaxPerSqm: expectedMax,
      verdict: verdicts.includes(parsed.verdict) ? parsed.verdict : null,
      confidence: confidences.includes(parsed.confidence) ? parsed.confidence : null,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : null,
      divergencePct,
    };
  } catch {
    return empty;
  }
}
