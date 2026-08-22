/**
 * Projeção de valorização de imóveis em planta / empreendimentos em construção.
 *
 * Base oficial: INE, Índice de Preços da Habitação (IPHab), indicador 0014767 —
 * taxa de variação homóloga, base 2025, categoria "Novos" (H11), série
 * trimestral nacional desde 2010.
 *
 * Nada aqui é inventado: as taxas dos cenários são médias de períodos REAIS da
 * série do INE, calculadas em `buildScenarioRates`. O motor é puro (sem rede
 * nem BD) — quem chama traz a série já lida.
 */

export type ScenarioKey = "prudente" | "central" | "otimista";

export interface ScenarioRate {
  key: ScenarioKey;
  label: string;
  /** Taxa anual em fração (0.08 = 8%/ano). */
  annualRate: number;
  /** Período da série do INE que originou esta taxa — mostrado ao utilizador. */
  basis: string;
}

export interface OffPlanScenario extends ScenarioRate {
  /** Taxa efetivamente aplicada, já com o ajuste regional. */
  effectiveAnnualRate: number;
  projectedValue: number;
  gainValue: number;
  /** Ganho total no período, em fração do preço atual. */
  gainPct: number;
}

export interface OffPlanProjection {
  currentPrice: number;
  years: number;
  regionalFactor: number;
  scenarios: OffPlanScenario[];
}

/** Nº de trimestres de cada janela dos cenários (4 trimestres = 1 ano). */
const WINDOW_10Y = 40;
const WINDOW_3Y = 12;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Constrói as três taxas a partir da série (valores em %, ordenados do mais
 * antigo para o mais recente). Cada cenário é a média de uma janela real:
 *
 * - prudente: série completa (inclui a crise de 2011-13, com anos negativos)
 * - central:  últimos 10 anos (um ciclo completo pós-crise)
 * - otimista: últimos 3 anos (o ciclo atual)
 *
 * Devolve null se a série for curta demais para ser honesta (< 3 anos).
 */
export function buildScenarioRates(seriesPct: number[]): ScenarioRate[] | null {
  if (!Array.isArray(seriesPct) || seriesPct.length < WINDOW_3Y) return null;

  const full = seriesPct;
  const last10 = seriesPct.slice(-WINDOW_10Y);
  const last3 = seriesPct.slice(-WINDOW_3Y);

  const years = (n: number) => Math.round(n / 4);

  return [
    {
      key: "prudente",
      label: "Prudente",
      annualRate: mean(full) / 100,
      basis: `média da série completa do INE (${years(full.length)} anos, inclui anos de queda)`,
    },
    {
      key: "central",
      label: "Central",
      annualRate: mean(last10) / 100,
      basis: `média dos últimos ${years(last10.length)} anos`,
    },
    {
      key: "otimista",
      label: "Otimista",
      annualRate: mean(last3) / 100,
      basis: `média dos últimos ${years(last3.length)} anos (ciclo atual)`,
    },
  ];
}

/**
 * Fator regional: quanto o concelho cresce acima/abaixo da média nacional.
 *
 * Ambas as pontas são INE — o numerador vem do indicador 0012234 (valor
 * mediano de venda €/m², por concelho/freguesia) e o denominador da mesma
 * série a nível nacional. Limitado a [0,6 ; 1,5] porque dados municipais são
 * ruidosos: um concelho pequeno com poucas transações produz variações
 * homólogas absurdas que não devem multiplicar a projeção.
 */
export function computeRegionalFactor(
  localYoyPct: number | null | undefined,
  nationalYoyPct: number | null | undefined
): number {
  if (
    typeof localYoyPct !== "number" ||
    typeof nationalYoyPct !== "number" ||
    !Number.isFinite(localYoyPct) ||
    !Number.isFinite(nationalYoyPct) ||
    nationalYoyPct <= 0
  ) {
    return 1;
  }
  const raw = localYoyPct / nationalYoyPct;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(1.5, Math.max(0.6, raw));
}

/** Anos (fracionários) entre duas datas; nunca negativo. */
export function yearsUntil(deliveryDate: string | Date, from: Date = new Date()): number {
  const target = deliveryDate instanceof Date ? deliveryDate : new Date(deliveryDate);
  if (Number.isNaN(target.getTime())) return 0;
  const ms = target.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Projeta o valor na conclusão: preço × (1 + taxa)^anos.
 *
 * Devolve null quando não há base para projetar (sem preço, ou a entrega já
 * passou) — nesse caso não se mostra nada, em vez de mostrar um número igual
 * ao preço atual como se fosse uma estimativa.
 */
export function projectOffPlanValue(params: {
  currentPrice: number;
  years: number;
  rates: ScenarioRate[];
  regionalFactor?: number;
}): OffPlanProjection | null {
  const { currentPrice, years, rates, regionalFactor = 1 } = params;

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  if (!Number.isFinite(years) || years <= 0) return null;
  if (!rates || rates.length === 0) return null;

  const scenarios: OffPlanScenario[] = rates.map((rate) => {
    const effectiveAnnualRate = rate.annualRate * regionalFactor;
    const projectedValue = currentPrice * Math.pow(1 + effectiveAnnualRate, years);
    const gainValue = projectedValue - currentPrice;
    return {
      ...rate,
      effectiveAnnualRate,
      projectedValue: Math.round(projectedValue),
      gainValue: Math.round(gainValue),
      gainPct: gainValue / currentPrice,
    };
  });

  return { currentPrice, years, regionalFactor, scenarios };
}
