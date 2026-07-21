/**
 * Seleção de comparáveis para a avaliação.
 *
 * O motivo de existir: uma avaliação de uma moradia em bom estado apanhava
 * ruínas a 429 €/m² como comparáveis e puxava o valor recomendado para baixo
 * de forma irrealista. Área e tipologia semelhantes não bastam — um imóvel
 * para recuperar e um imóvel habitável não são o mesmo produto, e o mercado
 * paga por eles preços que diferem várias vezes.
 *
 * Duas defesas, deliberadamente independentes:
 *  1. Estado de conservação, lido do anúncio (campo `status` + descrição).
 *  2. Outliers de €/m², por mediana — apanha o que a leitura do estado falhe,
 *     porque nem todos os anúncios de ruínas se identificam como tal.
 */

export type PropertyCondition = "ruin" | "needs_work" | "good" | "new";

/** Termos que denunciam um imóvel para recuperar, mesmo sem o campo `status`. */
const RUIN_TERMS = [
  "ruina",
  "ruína",
  "para recuperar",
  "a recuperar",
  "para restaurar",
  "para reconstruir",
  "para demolir",
  "devoluto",
  "para obras",
  "necessita de obras",
  "precisa de obras",
  "obras profundas",
  "para remodelar totalmente",
  "esqueleto",
];

const NEEDS_WORK_TERMS = [
  "para remodelar",
  "a remodelar",
  "necessita remodelacao",
  "necessita de remodelacao",
  "obras de remodelacao",
  "para modernizar",
  "a precisar",
];

function normalize(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Estado de conservação de um anúncio.
 *
 * O campo `status` do Idealista é a fonte primária ("renew" = para recuperar),
 * mas está em falta em muitos anúncios — daí a leitura da descrição.
 */
export function inferCondition(listing: {
  status?: string | null;
  description?: string | null;
  newDevelopment?: boolean | null;
}): PropertyCondition {
  const text = normalize(listing.description);

  if (RUIN_TERMS.some((term) => text.includes(normalize(term)))) return "ruin";

  const status = normalize(listing.status);
  if (status === "renew") return "needs_work";
  if (listing.newDevelopment || status === "newdevelopment") return "new";

  if (NEEDS_WORK_TERMS.some((term) => text.includes(normalize(term)))) return "needs_work";

  return "good";
}

/** O estado indicado pelo consultor no formulário, normalizado. */
export function subjectCondition(condition: string | null | undefined): PropertyCondition {
  const text = normalize(condition);
  if (!text) return "good";
  if (RUIN_TERMS.some((term) => text.includes(normalize(term)))) return "ruin";
  if (text.includes("novo") || text.includes("remodelado")) return "new";
  if (NEEDS_WORK_TERMS.some((term) => text.includes(normalize(term)))) return "needs_work";
  return "good";
}

/**
 * Um comparável só serve se estiver no mesmo patamar de estado.
 *
 * "ruin" e "needs_work" agrupam-se (ambos exigem investimento), tal como
 * "good" e "new" (ambos habitáveis). Comparar entre grupos é o erro que se
 * pretende evitar.
 */
export function conditionsAreComparable(
  subject: PropertyCondition,
  candidate: PropertyCondition
): boolean {
  const needsInvestment = (value: PropertyCondition) => value === "ruin" || value === "needs_work";
  return needsInvestment(subject) === needsInvestment(candidate);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Remove outliers de €/m² pelo desvio absoluto mediano.
 *
 * Preferido ao desvio-padrão porque a média e o desvio-padrão são eles
 * próprios arrastados pelos outliers — com três ruínas na amostra, o filtro
 * baseado na média passaria a aceitá-las.
 *
 * Abaixo de 4 comparáveis não se filtra: sem amostra não há como distinguir
 * um outlier de um mercado disperso, e ficar sem comparáveis é pior.
 */
export function removePriceOutliers<T extends { pricePerSqm?: number | null }>(
  comparables: T[],
  tolerance = 2.5
): { kept: T[]; removed: T[] } {
  const withPrice = comparables.filter(
    (item) => typeof item.pricePerSqm === "number" && item.pricePerSqm > 0
  );

  if (withPrice.length < 4) return { kept: comparables, removed: [] };

  const values = withPrice.map((item) => item.pricePerSqm as number);
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);

  // Amostra muito homogénea: qualquer desvio pareceria enorme.
  if (mad === 0) return { kept: comparables, removed: [] };

  const kept: T[] = [];
  const removed: T[] = [];

  for (const item of comparables) {
    const value = item.pricePerSqm;
    if (typeof value !== "number" || value <= 0) {
      kept.push(item);
      continue;
    }
    // 1.4826 converte o MAD em desvio-padrão equivalente.
    const score = Math.abs(value - center) / (1.4826 * mad);
    if (score > tolerance) removed.push(item);
    else kept.push(item);
  }

  return { kept, removed };
}

const CONDITION_LABELS: Record<PropertyCondition, string> = {
  ruin: "Para recuperar",
  needs_work: "A necessitar de obras",
  good: "Bom estado",
  new: "Novo/remodelado",
};

export function conditionLabel(condition: PropertyCondition): string {
  return CONDITION_LABELS[condition];
}
