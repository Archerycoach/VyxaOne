import type { ImtRegime } from "./types";

/**
 * IMT — tabelas práticas de 2026, Portugal Continental (OE2026: escalões
 * atualizados +2% face a 2025). Fonte: tabelas práticas publicadas (APCMC),
 * parcelas a abater verificadas por recálculo.
 *
 * Estrutura: até `upTo`, aplica-se `rate` sobre o valor TOTAL menos a
 * `deduction` (método da parcela a abater). Os dois últimos escalões são de
 * taxa única (deduction 0). Atualizar aqui quando sair a tabela de cada ano.
 */
interface ImtBracket {
  upTo: number; // limite superior do escalão (Infinity no último)
  rate: number;
  deduction: number;
}

export const IMT_TABLE_YEAR = 2026;

const IMT_HPP_2026: ImtBracket[] = [
  { upTo: 106346, rate: 0, deduction: 0 },
  { upTo: 145470, rate: 0.02, deduction: 2126.92 },
  { upTo: 198347, rate: 0.05, deduction: 6491.02 },
  { upTo: 330539, rate: 0.07, deduction: 10457.96 },
  { upTo: 660982, rate: 0.08, deduction: 13763.35 },
  { upTo: 1150853, rate: 0.06, deduction: 0 }, // taxa única
  { upTo: Infinity, rate: 0.075, deduction: 0 }, // taxa única
];

const IMT_SECUNDARIA_2026: ImtBracket[] = [
  { upTo: 106346, rate: 0.01, deduction: 0 },
  { upTo: 145470, rate: 0.02, deduction: 1063.46 },
  { upTo: 198347, rate: 0.05, deduction: 5427.56 },
  { upTo: 330539, rate: 0.07, deduction: 9394.5 },
  { upTo: 633931, rate: 0.08, deduction: 12699.89 },
  { upTo: 1150853, rate: 0.06, deduction: 0 }, // taxa única
  { upTo: Infinity, rate: 0.075, deduction: 0 }, // taxa única
];

/**
 * Calcula o IMT devido na compra de habitação no Continente.
 * O IMT incide sobre o maior entre preço e VPT — aqui usamos o valor passado
 * (na prática dos investidores, o preço de compra).
 */
export function calculateImt(value: number, regime: ImtRegime): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const table = regime === "hpp" ? IMT_HPP_2026 : IMT_SECUNDARIA_2026;
  const bracket = table.find((b) => value <= b.upTo) ?? table[table.length - 1];
  const imt = value * bracket.rate - bracket.deduction;
  return Math.max(0, Math.round(imt * 100) / 100);
}

/** Imposto do selo da aquisição: 0,8% sobre o valor da compra. */
export function calculateStampDutyPurchase(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 0.008 * 100) / 100;
}

/** Imposto do selo do crédito habitação: 0,6% (prazo > 5 anos). */
export function calculateStampDutyLoan(loanAmount: number): number {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) return 0;
  return Math.round(loanAmount * 0.006 * 100) / 100;
}
