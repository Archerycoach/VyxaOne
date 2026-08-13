import { calculateImt, calculateStampDutyLoan, calculateStampDutyPurchase } from "./imt";
import type {
  AnnualCashflowResult,
  PurchaseCostsResult,
  ReturnMetricsResult,
  UnderwritingAssumptions,
  UnderwritingResult,
} from "./types";

/**
 * Motor de cálculo da análise de investimento — funções puras, sem rede nem BD.
 * Convenções: taxas em frações (0.05 = 5%), valores em euros, resultados
 * anuais salvo indicação em contrário.
 */

export function calculatePurchaseCosts(a: UnderwritingAssumptions): PurchaseCostsResult {
  const { price, regime, notaryAndRegistration, loanAmount } = a.purchase;

  const imt = calculateImt(price, regime);
  const stampDutyPurchase = calculateStampDutyPurchase(price);
  const stampDutyLoan = calculateStampDutyLoan(loanAmount);
  const totalCosts = imt + stampDutyPurchase + stampDutyLoan + notaryAndRegistration;
  const totalInvestment = price + totalCosts;
  const equityRequired = Math.max(0, totalInvestment - loanAmount);

  return { imt, stampDutyPurchase, stampDutyLoan, notaryAndRegistration, totalCosts, totalInvestment, equityRequired };
}

/** Prestação mensal (amortização francesa). Taxa 0 → divisão simples. */
export function monthlyLoanPayment(loanAmount: number, annualRate: number, termYears: number): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  if (annualRate <= 0) return loanAmount / n;
  const i = annualRate / 12;
  return (loanAmount * i) / (1 - Math.pow(1 + i, -n));
}

export function calculateAnnualCashflow(a: UnderwritingAssumptions): AnnualCashflowResult {
  const r = a.rental;
  const grossAnnualRent = r.monthlyRent * 12;
  const effectiveAnnualRent = grossAnnualRent * (1 - r.vacancyRate);

  const operatingCosts =
    r.monthlyCondoFee * 12 +
    r.annualInsurance +
    r.annualImi +
    grossAnnualRent * r.maintenanceRate +
    effectiveAnnualRent * r.managementRate;

  const noi = effectiveAnnualRent - operatingCosts;

  const annualDebtService =
    monthlyLoanPayment(a.purchase.loanAmount, a.purchase.loanInterestRate, a.purchase.loanTermYears) * 12;

  const cashflowBeforeTax = noi - annualDebtService;

  // IRS cat. F: taxa sobre a renda efetiva menos gastos dedutíveis (aqui
  // aproximado: custos operacionais são dedutíveis; a amortização de capital
  // não é; os juros do crédito habitação para arrendamento também não são
  // dedutíveis na cat. F). Nunca negativo.
  const taxableIncome = Math.max(0, noi);
  const incomeTax = taxableIncome * r.rentalIncomeTaxRate;

  const cashflowAfterTax = cashflowBeforeTax - incomeTax;

  return {
    grossAnnualRent,
    effectiveAnnualRent,
    operatingCosts,
    noi,
    annualDebtService,
    cashflowBeforeTax,
    incomeTax,
    cashflowAfterTax,
  };
}

/**
 * TIR anual do projeto: capital próprio à cabeça (negativo), cash-flows
 * anuais após impostos, e no último ano a venda (valorizada, líquida de
 * custos de venda e do capital em dívida). Newton-Raphson com fallback por
 * bissecção; null se não convergir (ex.: todos os fluxos negativos).
 */
export function calculateIrr(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  const hasPositive = cashflows.some((c) => c > 0);
  const hasNegative = cashflows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null;

  const npv = (rate: number) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);

  // Bissecção em [-0.99, 10] — robusta para o intervalo realista de TIRs.
  let lo = -0.99;
  let hi = 10;
  let npvLo = npv(lo);
  const npvHi = npv(hi);
  if (npvLo * npvHi > 0) return null;

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-7) return mid;
    if (npvLo * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return (lo + hi) / 2;
}

/** Capital em dívida após `years` anos de prestações mensais. */
export function outstandingLoanBalance(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  afterYears: number
): number {
  if (loanAmount <= 0) return 0;
  const monthsPaid = Math.min(afterYears, termYears) * 12;
  const n = termYears * 12;
  if (annualRate <= 0) return Math.max(0, loanAmount * (1 - monthsPaid / n));
  const i = annualRate / 12;
  const payment = monthlyLoanPayment(loanAmount, annualRate, termYears);
  const balance = loanAmount * Math.pow(1 + i, monthsPaid) - payment * ((Math.pow(1 + i, monthsPaid) - 1) / i);
  return Math.max(0, balance);
}

export function calculateReturns(
  a: UnderwritingAssumptions,
  costs: PurchaseCostsResult,
  cashflow: AnnualCashflowResult
): ReturnMetricsResult {
  const { price, loanAmount, loanInterestRate, loanTermYears } = a.purchase;
  const { holdYears, annualAppreciation, sellingCostsRate } = a.exit;

  const grossYield = costs.totalInvestment > 0 ? cashflow.grossAnnualRent / costs.totalInvestment : 0;
  const netYield = costs.totalInvestment > 0 ? cashflow.noi / costs.totalInvestment : 0;
  const cashOnCash = costs.equityRequired > 0 ? cashflow.cashflowBeforeTax / costs.equityRequired : 0;

  // Fluxos para a TIR: ano 0 = -capital próprio; anos 1..N-1 = cash-flow após
  // IRS; ano N = cash-flow + venda líquida (preço valorizado - custos de
  // venda - capital em dívida). Renda mantida constante — conservador.
  const salePrice = price * Math.pow(1 + annualAppreciation, holdYears);
  const saleNet = salePrice * (1 - sellingCostsRate) - outstandingLoanBalance(loanAmount, loanInterestRate, loanTermYears, holdYears);

  const flows: number[] = [-costs.equityRequired];
  for (let year = 1; year <= holdYears; year++) {
    flows.push(cashflow.cashflowAfterTax + (year === holdYears ? saleNet : 0));
  }
  const irr = calculateIrr(flows);

  // Payback simples sobre o cash-flow antes de IRS (sem venda).
  let paybackYears: number | null = null;
  if (cashflow.cashflowBeforeTax > 0 && costs.equityRequired > 0) {
    const years = costs.equityRequired / cashflow.cashflowBeforeTax;
    paybackYears = years <= 50 ? Math.round(years * 10) / 10 : null;
  }

  return { grossYield, netYield, cashOnCash, irr, paybackYears };
}

/** Análise completa a partir dos pressupostos. */
export function runUnderwriting(a: UnderwritingAssumptions): UnderwritingResult {
  const costs = calculatePurchaseCosts(a);
  const cashflow = calculateAnnualCashflow(a);
  const returns = calculateReturns(a, costs, cashflow);
  return { costs, cashflow, returns };
}
