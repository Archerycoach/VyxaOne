/**
 * Homogeneização de comparáveis — o núcleo técnico do MÉTODO COMPARATIVO.
 *
 * Base: "Métodos de Avaliação Imobiliária" (Ruy Figueiredo, SIIMGROUP, 2026).
 *
 * PORQUÊ ISTO EXISTE: fazer a média simples dos €/m² dos anúncios é o erro
 * clássico. O manual demonstra-o (pág. 65) com dois comparáveis reais:
 *
 *   Média CRUA das referências ......... 1.027 €/m²  →  82.160 €
 *   Média HOMOGENEIZADA ................ 1.267 €/m²  → 101.360 €   (+23%)
 *
 * Homogeneizar é "transformar alhos em bugalhos": ajustar o €/m² de cada
 * referência PARA AS CONDIÇÕES do imóvel a avaliar, através de coeficientes
 * multiplicativos, ANTES de calcular a média.
 *
 * Convenção dos coeficientes (manual, variável explicativa 3):
 *   coef > 1  →  a referência é PIOR que o objeto (o valor dela sobe)
 *   coef = 1  →  equivalentes
 *   coef < 1  →  a referência é MELHOR que o objeto (o valor dela desce)
 */

/** Expoente da fórmula de ajustamento de área, por tipo de produto (pág. 44). */
const AREA_EXPONENT: Record<string, number> = {
  apartment: 4,
  house: 4,
  store: 2,
  commercial: 2,
  office: 2,
  warehouse: 20,
  land: 4,
};

/**
 * Coeficiente de VISTAS (pág. 52). Tabela do manual, usando o ponto médio de
 * cada intervalo. O coeficiente aplica-se ao rácio objeto/referência.
 */
export const VIEW_IMPACT: Record<string, number> = {
  sea_front_close: 1.35,
  sea_front: 1.25,
  sea_distant: 1.15,
  sea_far: 1.075,
  sea_side: 1.025,
  river: 1.125,
  ria: 1.075,
  nature: 1.075,
  city_panoramic: 1.275,
  building: 1.0,
  cemetery: 0.8,
  privacy_invaded: 0.8,
};

/** Coeficiente de vetustez do CIMI (pág. 15/16) — idade aparente do imóvel. */
export function vetustezCoefficient(ageYears: number | null | undefined): number {
  const age = Number(ageYears);
  if (!Number.isFinite(age) || age < 0) return 1;
  if (age < 3) return 1;
  if (age <= 5) return 0.98;
  if (age <= 10) return 0.95;
  if (age <= 15) return 0.9;
  if (age <= 20) return 0.85;
  if (age <= 30) return 0.8;
  if (age <= 40) return 0.75;
  if (age <= 50) return 0.65;
  if (age <= 60) return 0.55;
  if (age <= 80) return 0.45;
  return 0.35;
}

/** Qualidade global (idade + conservação + acabamentos), variável 6. */
const CONDITION_QUALITY: Record<string, number> = {
  new: 1.12,
  renovated: 1.08,
  good: 1.0,
  needs_work: 0.88,
  ruin: 0.6,
};

function qualityOf(condition: string | null | undefined): number {
  const c = String(condition || "good").toLowerCase();
  if (c.includes("new") || c.includes("nov")) return CONDITION_QUALITY.new;
  if (c.includes("renov") || c.includes("remodel")) return CONDITION_QUALITY.renovated;
  if (c.includes("ruin") || c.includes("ruína")) return CONDITION_QUALITY.ruin;
  if (c.includes("work") || c.includes("obras") || c.includes("recuper")) return CONDITION_QUALITY.needs_work;
  return CONDITION_QUALITY.good;
}

/**
 * Posição na vertical do piso (variável 4). O manual sublinha o efeito do
 * ELEVADOR: sem elevador, a partir do 3.º andar o valor cai abaixo do r/c.
 */
export function floorQuality(floor: number | null | undefined, hasLift: boolean | null | undefined): number {
  const f = Number(floor);
  if (!Number.isFinite(f)) return 1;
  if (hasLift === false) {
    // Sem elevador: 1.º ainda valoriza, 2.º neutro, 3.º+ penalizado.
    if (f <= 0) return 1.0;
    if (f === 1) return 1.02;
    if (f === 2) return 1.0;
    if (f === 3) return 0.93;
    return 0.88;
  }
  // Com elevador: andares altos valorizam ligeiramente; r/c e cave penalizam.
  if (f < 0) return 0.85;
  if (f === 0) return 0.94;
  if (f <= 2) return 1.0;
  if (f <= 5) return 1.03;
  return 1.05;
}

export interface HomogenizationSubject {
  area: number | null;
  propertyType: string | null;
  condition?: string | null;
  floor?: number | null;
  hasLift?: boolean | null;
  view?: string | null;
  ageYears?: number | null;
}

export interface HomogenizationComparable {
  pricePerSqm: number | null;
  area: number | null;
  /** "active" = preço PEDIDO (aplica-se o fator negocial); "sold" = escritura. */
  status?: "active" | "sold";
  condition?: string | null;
  floor?: number | null;
  hasLift?: boolean | null;
  view?: string | null;
  ageYears?: number | null;
}

export interface HomogenizationLine {
  label: string;
  coefficient: number;
}

export interface HomogenizedComparable {
  /** €/m² original do anúncio/escritura. */
  rawPricePerSqm: number;
  /** €/m² já ajustado às condições do imóvel a avaliar. */
  homogenizedPricePerSqm: number;
  /** Produto de todos os coeficientes aplicados. */
  totalCoefficient: number;
  lines: HomogenizationLine[];
}

/** Limita um coeficiente a um intervalo defensável. */
function clamp(value: number, min = 0.6, max = 1.6): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(min, value));
}

/**
 * Fator negocial (variável 1): os anúncios traduzem o valor PEDIDO, não o de
 * fecho. Quando se conhece a diferença real entre pedido e escritura (INE vs
 * anúncios da zona), usa-se essa; senão, um desconto prudente de 8%.
 */
export function negotiationCoefficient(askingVsSoldGapPct: number | null | undefined): number {
  const gap = Number(askingVsSoldGapPct);
  if (!Number.isFinite(gap) || gap <= 0) return 0.92;
  // gap = quanto os anúncios pedem ACIMA das escrituras.
  return clamp(1 / (1 + gap / 100), 0.75, 1);
}

/**
 * Homogeneíza UM comparável para as condições do imóvel a avaliar.
 *
 * Cada coeficiente é o rácio qualidade(objeto)/qualidade(referência): se a
 * referência for pior, o coeficiente > 1 e o €/m² dela sobe até ao nível do
 * objeto — que é o que o manual manda fazer.
 */
export function homogenizeComparable(
  subject: HomogenizationSubject,
  comparable: HomogenizationComparable,
  options: { askingVsSoldGapPct?: number | null } = {},
): HomogenizedComparable | null {
  const raw = Number(comparable.pricePerSqm);
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const lines: HomogenizationLine[] = [];
  const push = (label: string, coefficient: number) => {
    if (Number.isFinite(coefficient) && Math.abs(coefficient - 1) > 0.001) {
      lines.push({ label, coefficient: Math.round(coefficient * 1000) / 1000 });
    }
  };

  // 1) FATOR NEGOCIAL — só para anúncios (preço pedido).
  if (comparable.status !== "sold") {
    push("Fator negocial (pedido → escritura)", negotiationCoefficient(options.askingVsSoldGapPct));
  }

  // 2) ÁREA PRINCIPAL — pOA = pREF × (AREF/AOA)^(1/n)   (pág. 43/44).
  //    Quanto MENOR a área, MAIOR o €/m²: comparar um T2 de 50 m² com um de
  //    80 m² sem este ajuste inflaciona a avaliação.
  const aRef = Number(comparable.area);
  const aObj = Number(subject.area);
  if (Number.isFinite(aRef) && Number.isFinite(aObj) && aRef > 0 && aObj > 0) {
    const n = AREA_EXPONENT[String(subject.propertyType || "apartment")] ?? 4;
    push(`Área (${Math.round(aRef)} m² → ${Math.round(aObj)} m²)`, clamp(Math.pow(aRef / aObj, 1 / n)));
  }

  // 3) ASPETO GLOBAL — idade + conservação + acabamentos (variável 6).
  const qObj = qualityOf(subject.condition);
  const qRef = qualityOf(comparable.condition);
  push("Estado de conservação", clamp(qObj / qRef));

  // 4) VETUSTEZ — idade, quando conhecida dos dois lados.
  if (subject.ageYears != null && comparable.ageYears != null) {
    push("Idade do imóvel", clamp(vetustezCoefficient(subject.ageYears) / vetustezCoefficient(comparable.ageYears)));
  }

  // 5) POSIÇÃO VERTICAL — piso e elevador (variável 4).
  if (subject.floor != null || comparable.floor != null) {
    const fObj = floorQuality(subject.floor, subject.hasLift);
    const fRef = floorQuality(comparable.floor, comparable.hasLift);
    push("Piso / elevador", clamp(fObj / fRef));
  }

  // 6) VISTAS (variável 5, tabela da pág. 52).
  if (subject.view || comparable.view) {
    const vObj = VIEW_IMPACT[String(subject.view || "building")] ?? 1;
    const vRef = VIEW_IMPACT[String(comparable.view || "building")] ?? 1;
    push("Vistas", clamp(vObj / vRef));
  }

  const totalCoefficient = lines.reduce((acc, l) => acc * l.coefficient, 1);
  return {
    rawPricePerSqm: raw,
    homogenizedPricePerSqm: raw * totalCoefficient,
    totalCoefficient: Math.round(totalCoefficient * 1000) / 1000,
    lines,
  };
}

export interface HomogenizationSummary {
  /** €/m² homogeneizado (mediana — robusta a outliers). */
  pricePerSqm: number | null;
  /** Média crua, para mostrar a diferença que a homogeneização faz. */
  rawPricePerSqm: number | null;
  sampleSize: number;
  /** Diferença % entre homogeneizado e cru (o "risco da média" do manual). */
  deltaPct: number | null;
  items: HomogenizedComparable[];
}

function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Homogeneíza um conjunto de comparáveis e resume o resultado. */
export function homogenizeComparables(
  subject: HomogenizationSubject,
  comparables: HomogenizationComparable[],
  options: { askingVsSoldGapPct?: number | null } = {},
): HomogenizationSummary {
  const items = comparables
    .map((c) => homogenizeComparable(subject, c, options))
    .filter((x): x is HomogenizedComparable => x !== null);

  const homogenized = median(items.map((i) => i.homogenizedPricePerSqm));
  const rawAvg = items.length
    ? items.reduce((sum, i) => sum + i.rawPricePerSqm, 0) / items.length
    : null;

  return {
    pricePerSqm: homogenized,
    rawPricePerSqm: rawAvg,
    sampleSize: items.length,
    deltaPct:
      homogenized && rawAvg ? Math.round(((homogenized / rawAvg) - 1) * 1000) / 10 : null,
    items,
  };
}
