/**
 * Métodos do CUSTO e do RENDIMENTO — as duas abordagens que, no manual,
 * validam o método comparativo.
 *
 * Base: "Métodos de Avaliação Imobiliária" (Ruy Figueiredo, SIIMGROUP, 2026).
 *
 * Nenhum destes métodos substitui os comparáveis; servem de CONTROLO. Quando
 * os três apontam para valores próximos, a avaliação é sólida; quando divergem
 * muito, há algo a explicar — e é isso que se mostra ao proprietário.
 */

// ============================ MÉTODO DO CUSTO ============================
//
//   V = (T + ET) + (C + EC) + (EV + L)
//
// que se resolve em ordem a V, porque EV e L são percentagens do próprio V:
//
//   V = (1,075·T + 1,10·C − Obras) / (1 − EV% − L%)

/** Custo de construção a novo, €/m² (pág. 74). */
export const CONSTRUCTION_COST: Record<string, { min: number; max: number; label: string }> = {
  economico: { min: 600, max: 800, label: "Construção económica" },
  corrente: { min: 900, max: 1250, label: "Construção corrente" },
  alta: { min: 1000, max: 1750, label: "Construção de alta qualidade" },
};

/** Encargos conexos com a construção, em % de C (pág. 76). */
const EC_PCT: Record<string, number> = { moradia: 0.10, predio: 0.15, empreendimento: 0.20 };

/** Lucro do promotor, em % de V (pág. 79). */
const PROFIT_PCT: Record<string, number> = { moradia: 0.125, predio: 0.175, empreendimento: 0.225 };

/** Encargos com a venda: (3% a 5%) × 1,23 IVA → usa-se o topo, 6,15% (pág. 78). */
const SALE_COST_PCT = 0.0615;

/** Encargos com a aquisição do terreno: IMT 6,5% + selo 0,8% + 0,2% (pág. 70). */
const LAND_ACQUISITION_PCT = 0.075;

export interface CostMethodInput {
  /** Valor do terreno/lote (€). Se ausente, estima-se por quota do valor. */
  landValue?: number | null;
  /** Área bruta de construção (m²). */
  constructionArea: number;
  /** Qualidade da construção: economico | corrente | alta. */
  quality?: keyof typeof CONSTRUCTION_COST;
  /** Escala: moradia | predio | empreendimento. */
  scale?: keyof typeof EC_PCT;
  /** Obras em falta no imóvel usado (€) — o manual subtrai-as (pág. 82). */
  worksNeeded?: number | null;
  /** Alternativa ao landValue: valor de referência para estimar o terreno. */
  referenceValue?: number | null;
  /** Quota do terreno no valor final (pág. 72): 10% a 40%, típico 25%. */
  landQuotaPct?: number;
}

export interface CostMethodResult {
  valueMin: number;
  valueMax: number;
  landValue: number;
  constructionCost: { min: number; max: number };
  breakdown: string[];
}

export function costMethod(input: CostMethodInput): CostMethodResult | null {
  const area = Number(input.constructionArea);
  if (!Number.isFinite(area) || area <= 0) return null;

  const quality = input.quality && CONSTRUCTION_COST[input.quality] ? input.quality : "corrente";
  const scale = input.scale && EC_PCT[input.scale] ? input.scale : "moradia";
  const cost = CONSTRUCTION_COST[quality];

  // Terreno: valor indicado ou quota do valor de referência (pág. 72).
  const quota = Number.isFinite(Number(input.landQuotaPct)) ? Number(input.landQuotaPct) : 0.25;
  const land =
    Number(input.landValue) > 0
      ? Number(input.landValue)
      : Number(input.referenceValue) > 0
      ? Number(input.referenceValue) * quota
      : 0;

  const works = Number(input.worksNeeded) > 0 ? Number(input.worksNeeded) : 0;
  const ecPct = EC_PCT[scale];
  const profitPct = PROFIT_PCT[scale];
  const denominator = 1 - SALE_COST_PCT - profitPct;
  if (denominator <= 0) return null;

  const investment = (c: number) => (1 + LAND_ACQUISITION_PCT) * land + (1 + ecPct) * (c * area) - works;
  const valueMin = investment(cost.min) / denominator;
  const valueMax = investment(cost.max) / denominator;

  const breakdown = [
    `Terreno: ${Math.round(land).toLocaleString("pt-PT")} € (+${Math.round(LAND_ACQUISITION_PCT * 100)}% de encargos de aquisição)`,
    `Construção: ${area} m² × ${cost.min}–${cost.max} €/m² (${cost.label})`,
    `Encargos conexos: ${Math.round(ecPct * 100)}% do custo de construção`,
    works > 0 ? `Obras em falta descontadas: −${Math.round(works).toLocaleString("pt-PT")} €` : "",
    `Encargos de venda ${(SALE_COST_PCT * 100).toFixed(2)}% + lucro do promotor ${Math.round(profitPct * 100)}%`,
  ].filter(Boolean);

  return {
    valueMin: Math.max(0, Math.round(valueMin)),
    valueMax: Math.max(0, Math.round(valueMax)),
    landValue: Math.round(land),
    constructionCost: { min: cost.min, max: cost.max },
    breakdown,
  };
}

// ========================== MÉTODO DO RENDIMENTO ==========================
//
//   V = (r × 12) / t        r = renda mensal, t = yield
//
// Yields habitacionais (pág. 91/92): 2–3% procura fraca, 4–6% equilibrada,
// 7–10% alta procura. Tipologias baixas (T0–T2) têm yield maior que as altas.

export interface IncomeMethodInput {
  /** Renda mensal de mercado (€). */
  monthlyRent: number;
  /** Yield bruta anual (ex.: 0.05). Se ausente, deduz-se da tipologia. */
  yieldRate?: number | null;
  /** Tipologia (0 = T0). Usada para estimar a yield quando não é dada. */
  bedrooms?: number | null;
}

export interface IncomeMethodResult {
  value: number;
  yieldRate: number;
  /** Rentabilidade líquida estimada: 75–85% da bruta (pág. 106). */
  netYieldRate: number;
  note: string;
}

/** Yield típica por tipologia, em mercado equilibrado (pág. 92). */
export function typicalYield(bedrooms: number | null | undefined): number {
  const b = Number(bedrooms);
  if (!Number.isFinite(b)) return 0.05;
  if (b <= 1) return 0.065;
  if (b === 2) return 0.055;
  if (b === 3) return 0.05;
  return 0.045;
}

export function incomeMethod(input: IncomeMethodInput): IncomeMethodResult | null {
  const rent = Number(input.monthlyRent);
  if (!Number.isFinite(rent) || rent <= 0) return null;

  const rate =
    Number(input.yieldRate) > 0 ? Number(input.yieldRate) : typicalYield(input.bedrooms);
  if (rate <= 0) return null;

  // O manual: o líquido fica entre 75% e 85% do bruto (vazios, IMI, condomínio,
  // IRS, obras). Usa-se o ponto médio, 80%.
  const netYieldRate = rate * 0.8;

  return {
    value: Math.round((rent * 12) / rate),
    yieldRate: rate,
    netYieldRate: Math.round(netYieldRate * 10000) / 10000,
    note:
      `Renda mensal ${Math.round(rent).toLocaleString("pt-PT")} € a uma yield bruta de ` +
      `${(rate * 100).toFixed(1)}% (líquida estimada ${(netYieldRate * 100).toFixed(1)}%, ` +
      `após vazios, IMI, condomínio e impostos).`,
  };
}

// ===================== ÁREAS DEPENDENTES (pág. 25 a 35) =====================
//
// "As varandas não têm valor de mercado": o €/m² de uma área dependente é uma
// FRAÇÃO do €/m² da área principal. Estacionamentos e arrecadações valem
// valores absolutos de mercado.

/** Coeficiente α das varandas (pág. 26). */
export const BALCONY_ALPHA = { open: 0.5, poorly_enclosed: 0.85, enclosed: 1.0 };

/** Valores de referência de estacionamento (pág. 34). */
export const PARKING_VALUE = {
  individual: 10000,
  double: 20000,
  double_row: 15000,
  triple_row: 22500,
  outdoor: 5000,
};

export interface DependentAreasInput {
  /** €/m² da área principal, para derivar o valor das varandas. */
  mainPricePerSqm: number;
  balconyOpenSqm?: number | null;
  balconyEnclosedSqm?: number | null;
  storageSqm?: number | null;
  /** €/m² da arrecadação: 250 a 1000 conforme localização/acabamentos (pág. 27). */
  storagePricePerSqm?: number | null;
  parkingType?: keyof typeof PARKING_VALUE | null;
  parkingCount?: number | null;
}

export interface DependentAreasResult {
  total: number;
  lines: { label: string; value: number }[];
}

export function valueDependentAreas(input: DependentAreasInput): DependentAreasResult {
  const lines: { label: string; value: number }[] = [];
  const base = Number(input.mainPricePerSqm) || 0;

  const openSqm = Number(input.balconyOpenSqm) || 0;
  if (openSqm > 0 && base > 0) {
    const v = Math.round(openSqm * base * BALCONY_ALPHA.open);
    lines.push({ label: `Varanda aberta (${openSqm} m² × 50% do €/m²)`, value: v });
  }

  const enclosedSqm = Number(input.balconyEnclosedSqm) || 0;
  if (enclosedSqm > 0 && base > 0) {
    const v = Math.round(enclosedSqm * base * BALCONY_ALPHA.enclosed);
    lines.push({ label: `Varanda fechada (${enclosedSqm} m² × 100% do €/m²)`, value: v });
  }

  const storageSqm = Number(input.storageSqm) || 0;
  if (storageSqm > 0) {
    const unit = Number(input.storagePricePerSqm) > 0 ? Number(input.storagePricePerSqm) : 500;
    lines.push({ label: `Arrecadação (${storageSqm} m² × ${unit} €/m²)`, value: Math.round(storageSqm * unit) });
  }

  const parkingCount = Number(input.parkingCount) || 0;
  if (parkingCount > 0 && input.parkingType && PARKING_VALUE[input.parkingType]) {
    const unit = PARKING_VALUE[input.parkingType];
    lines.push({
      label: `Estacionamento (${parkingCount} × ${unit.toLocaleString("pt-PT")} €)`,
      value: unit * parkingCount,
    });
  }

  return { total: lines.reduce((sum, l) => sum + l.value, 0), lines };
}
