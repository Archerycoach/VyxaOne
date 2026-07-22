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


/**
 * O comparável é do mesmo tipo de imóvel?
 *
 * Um apartamento T4 apareceu numa avaliação de moradia porque a única
 * filtragem era por área e tipologia. Área semelhante não faz de um
 * apartamento um comparável de uma moradia — são produtos diferentes, com
 * mercados e €/m² diferentes.
 */
export function matchesPropertyType(
  subjectType: string | null | undefined,
  listing: { propertyType?: string | null; address?: string | null; description?: string | null }
): boolean {
  const subject = normalize(subjectType);
  if (!subject) return true;

  const haystack = normalize(
    [listing.propertyType, listing.address, listing.description].filter(Boolean).join(" ")
  );

  const isHouseWord = /moradia|vivenda|casa|chale|quinta|herdade|solar/.test(haystack);
  const isFlatWord = /apartamento|t[0-9]|duplex|studio|estudio|kitchenette/.test(haystack);

  if (subject === "house" || subject === "villa") {
    // Uma moradia compara-se com moradias. Se o anúncio se identifica como
    // apartamento, está fora, mesmo que a área bata certo.
    if (isFlatWord && !isHouseWord) return false;
    return true;
  }

  if (subject === "apartment") {
    if (isHouseWord && !isFlatWord) return false;
    return true;
  }

  return true;
}

/**
 * Descarta comparáveis muito abaixo da referência da zona.
 *
 * Rede de segurança para as ruínas que nem o campo `status` nem a descrição
 * denunciam: um imóvel a 40% do €/m² mediano da zona não é um comparável de
 * um imóvel habitável, seja qual for o texto do anúncio.
 */
export function removeBelowZoneFloor<T extends { pricePerSqm?: number | null }>(
  comparables: T[],
  zonePricePerSqm: number | null,
  floorRatio = 0.55
): { kept: T[]; removed: T[] } {
  if (!zonePricePerSqm || zonePricePerSqm <= 0) return { kept: comparables, removed: [] };

  const floor = zonePricePerSqm * floorRatio;
  const kept: T[] = [];
  const removed: T[] = [];

  for (const item of comparables) {
    const value = item.pricePerSqm;
    if (typeof value === "number" && value > 0 && value < floor) removed.push(item);
    else kept.push(item);
  }

  return { kept, removed };
}


/**
 * Critérios de análise escolhidos pelo consultor.
 *
 * Distinção deliberada entre dois tipos:
 *  - FILTROS (ano, piso, classe energética, preço): excluem. São atributos
 *    objetivos em que um desvio torna o imóvel genuinamente incomparável.
 *  - PREFERÊNCIAS (características): pontuam, não excluem. Um comparável sem
 *    piscina continua a informar o valor — só informa menos do que um com.
 *    Excluir por características esvaziaria a amostra em zonas com pouca
 *    oferta, que é exatamente onde os comparáveis mais fazem falta.
 */
export interface ComparableCriteria {
  minPrice?: number | null;
  maxPrice?: number | null;
  minYearBuilt?: number | null;
  maxYearBuilt?: number | null;
  energyRatings?: string[];
  floors?: string[];
  /** Características desejadas. Pontuam; nunca excluem. */
  preferredFeatures?: string[];
}

export interface ScoredComparable<T> {
  item: T;
  /** 0-100. Quantas preferências o comparável satisfaz. */
  preferenceScore: number;
  matchedFeatures: string[];
}

/** Aplica os filtros que EXCLUEM. */
export function applyHardCriteria<
  T extends { price?: number | null; yearBuilt?: number | null; energyRating?: string | null; floor?: number | string | null }
>(comparables: T[], criteria: ComparableCriteria): { kept: T[]; removed: T[] } {
  const kept: T[] = [];
  const removed: T[] = [];

  for (const item of comparables) {
    let ok = true;

    if (criteria.minPrice && item.price && item.price < criteria.minPrice) ok = false;
    if (criteria.maxPrice && item.price && item.price > criteria.maxPrice) ok = false;

    // Um ano em falta não exclui: a maioria dos anúncios não o declara, e
    // excluir por ausência de dado deitaria fora metade da amostra.
    if (ok && criteria.minYearBuilt && item.yearBuilt && item.yearBuilt < criteria.minYearBuilt) ok = false;
    if (ok && criteria.maxYearBuilt && item.yearBuilt && item.yearBuilt > criteria.maxYearBuilt) ok = false;

    if (ok && criteria.energyRatings?.length && item.energyRating) {
      const rating = normalize(item.energyRating);
      if (!criteria.energyRatings.some((r) => normalize(r) === rating)) ok = false;
    }

    if (ok) kept.push(item);
    else removed.push(item);
  }

  return { kept, removed };
}

/**
 * Pontua os comparáveis pelas características desejadas e ordena-os.
 *
 * Nenhum é removido: os mais parecidos ficam à cabeça, e a amostra mantém-se
 * inteira para o cálculo do €/m².
 */
export function scoreByPreferences<T extends { features?: string[]; address?: string | null }>(
  comparables: T[],
  preferredFeatures: string[] = []
): ScoredComparable<T>[] {
  if (preferredFeatures.length === 0) {
    return comparables.map((item) => ({ item, preferenceScore: 0, matchedFeatures: [] }));
  }

  const wanted = preferredFeatures.map(normalize).filter(Boolean);

  const scored = comparables.map((item) => {
    const haystack = normalize([...(item.features || []), item.address || ""].join(" "));
    const matched = wanted.filter((feature) => haystack.includes(feature));

    return {
      item,
      preferenceScore: Math.round((matched.length / wanted.length) * 100),
      matchedFeatures: matched,
    };
  });

  return scored.sort((a, b) => b.preferenceScore - a.preferenceScore);
}
