/**
 * Ajuste do €/m² de referência pelas características do imóvel.
 *
 * O que faltava à fórmula: a referência (INE + comparáveis + zona) é uma
 * MÉDIA da zona — mistura imóveis modestos e bons. Um imóvel em bom estado
 * com bomba de calor e vistas desafogadas não vale a média da zona; vale
 * acima dela. Era este passo que uma avaliação humana fazia e a nossa não:
 * partir da referência e ajustá-la ao imóvel concreto, com o raciocínio à
 * vista.
 *
 * Os ajustes são deliberadamente MODESTOS e limitados no total: cada um é
 * uma correção de poucos por cento, não um multiplicador de entusiasmo. O
 * lote é tratado à parte (landValueAdjustment) porque é um valor absoluto,
 * não percentual.
 */

export interface ValueFactorInput {
  condition?: string | null;
  hasHeatPump?: boolean | null;
  hasSolarPanels?: boolean | null;
  hasAirConditioning?: boolean | null;
  hasOpenViews?: boolean | null;
  hasSeaView?: boolean | null;
  hasPool?: boolean | null;
  hasGarage?: boolean | null;
  energyRating?: string | null;
  /** Só moradias: térrea tem escassez de oferta e procura própria. */
  isSingleStorey?: boolean | null;
}

export interface FactorLine {
  label: string;
  pct: number;
}

export interface ValueFactorResult {
  /** Multiplicador final (ex.: 1.09 = +9%). */
  multiplier: number;
  totalPct: number;
  breakdown: FactorLine[];
}

/** O total nunca passa disto, para os fatores não se somarem ao absurdo. */
const MAX_TOTAL_PCT = 15;
const MIN_TOTAL_PCT = -20;

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function calculateValueFactors(input: ValueFactorInput): ValueFactorResult {
  const lines: FactorLine[] = [];
  const add = (label: string, pct: number) => lines.push({ label, pct });

  // Estado de conservação. "Bom estado" é a linha de base — a referência da
  // zona já assume um imóvel habitável médio.
  const condition = normalizeText(input.condition);
  if (condition.includes("novo") || condition.includes("remodelado")) {
    add("Novo / totalmente remodelado", 8);
  } else if (condition.includes("remodelar") || condition.includes("obras")) {
    add("A necessitar de obras", -12);
  }

  // Eficiência energética: reduz custos mensais reais e é cada vez mais
  // um critério de compra, não um extra.
  if (input.hasHeatPump) add("Bomba de calor", 2);
  if (input.hasSolarPanels) add("Painéis solares", 2);
  if (input.hasAirConditioning) add("Ar condicionado", 1);

  const rating = normalizeText(input.energyRating);
  if (rating === "a+" || rating === "a") add(`Classe energética ${rating.toUpperCase()}`, 3);
  else if (rating === "e" || rating === "f") add(`Classe energética ${rating.toUpperCase()}`, -4);

  // Vistas: desafogada é um prémio real; mar é maior e substitui-a (não
  // se somam — a vista de mar já é desafogada).
  if (input.hasSeaView) add("Vista de mar", 8);
  else if (input.hasOpenViews) add("Vistas desafogadas", 4);

  if (input.hasPool) add("Piscina", 3);
  if (input.hasGarage) add("Garagem", 2);

  // Moradias térreas: oferta escassa e procura específica (famílias,
  // compradores seniores) — foi um dos fatores que o cálculo ignorava e
  // uma avaliação humana apontou de imediato.
  if (input.isSingleStorey) add("Moradia térrea (oferta escassa)", 3);

  const rawTotal = lines.reduce((sum, line) => sum + line.pct, 0);
  const totalPct = Math.max(MIN_TOTAL_PCT, Math.min(MAX_TOTAL_PCT, rawTotal));

  return {
    multiplier: 1 + totalPct / 100,
    totalPct,
    breakdown: lines,
  };
}

/** Texto do desdobramento, para o documento e para a IA. */
export function describeFactorBreakdown(result: ValueFactorResult): string | null {
  if (result.breakdown.length === 0) return null;

  const parts = result.breakdown.map(
    (line) => `${line.label} (${line.pct > 0 ? "+" : ""}${line.pct}%)`
  );
  return (
    `Ajuste ao valor de referência da zona: ${parts.join(", ")}. ` +
    `Total: ${result.totalPct > 0 ? "+" : ""}${result.totalPct}%.`
  );
}
