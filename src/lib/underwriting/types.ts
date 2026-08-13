/**
 * Análise de investimento imobiliário ("property verdict") — tipos partilhados.
 *
 * Tudo determinístico e puro: os módulos deste diretório não tocam em rede nem
 * em base de dados — recebem pressupostos, devolvem números. A recolha de dados
 * (rendas do Idealista, referências de zona) vive nos endpoints que os chamam.
 */

/** Regime de IMT aplicável à compra. */
export type ImtRegime = "hpp" | "secundaria";

export interface PurchaseAssumptions {
  /** Preço de aquisição considerado (pode ser abaixo do pedido). */
  price: number;
  regime: ImtRegime;
  /** Custos de escritura + registos (estimativa fixa editável). */
  notaryAndRegistration: number;
  /** Financiamento: montante do empréstimo (0 = compra a pronto). */
  loanAmount: number;
  /** TAN do empréstimo (ex.: 0.038 = 3,8%). */
  loanInterestRate: number;
  /** Prazo do empréstimo em anos. */
  loanTermYears: number;
}

export interface RentalAssumptions {
  /** Renda mensal bruta estimada. */
  monthlyRent: number;
  /** Vacância + incobráveis, fração da renda anual (0.08 = ~1 mês/ano). */
  vacancyRate: number;
  /** Condomínio mensal. */
  monthlyCondoFee: number;
  /** Seguro(s) anual(is) — multirriscos (+ vida se financiado, se o utilizador quiser). */
  annualInsurance: number;
  /** Manutenção anual, fração da renda anual (0.05 = 5%). */
  maintenanceRate: number;
  /** Gestão do arrendamento, fração da renda anual (0 se gerido pelo próprio). */
  managementRate: number;
  /** IMI anual em euros (calculado fora: VPT × taxa do município). */
  annualImi: number;
  /** Taxa marginal de IRS sobre rendas (ex.: 0.25 taxa especial cat. F). */
  rentalIncomeTaxRate: number;
}

export interface ExitAssumptions {
  /** Horizonte de investimento em anos (para IRR/payback). */
  holdYears: number;
  /** Valorização anual esperada do imóvel (0.02 = 2%/ano). */
  annualAppreciation: number;
  /** Custos de venda no fim (mediação+outros), fração do preço de venda. */
  sellingCostsRate: number;
}

export interface UnderwritingAssumptions {
  purchase: PurchaseAssumptions;
  rental: RentalAssumptions;
  exit: ExitAssumptions;
}

export interface PurchaseCostsResult {
  imt: number;
  /** Imposto do selo da aquisição (0,8%). */
  stampDutyPurchase: number;
  /** Imposto do selo do crédito (0,6% >5 anos), 0 se não financiado. */
  stampDutyLoan: number;
  notaryAndRegistration: number;
  totalCosts: number;
  /** Preço + custos totais. */
  totalInvestment: number;
  /** Capital próprio necessário (investimento total - empréstimo). */
  equityRequired: number;
}

export interface AnnualCashflowResult {
  grossAnnualRent: number;
  effectiveAnnualRent: number;
  operatingCosts: number;
  /** Resultado operacional líquido (antes de financiamento e IRS). */
  noi: number;
  /** Prestação anual do empréstimo (juros+capital), 0 se a pronto. */
  annualDebtService: number;
  /** Cash-flow antes de impostos, depois de financiamento. */
  cashflowBeforeTax: number;
  /** IRS estimado sobre o rendimento predial. */
  incomeTax: number;
  cashflowAfterTax: number;
}

export interface ReturnMetricsResult {
  grossYield: number;
  netYield: number;
  /** Cash-on-cash: cashflow antes de IRS / capital próprio investido. */
  cashOnCash: number;
  /** TIR do projeto no horizonte definido (com venda no fim), fração anual. */
  irr: number | null;
  /** Anos até o cash-flow acumulado (antes IRS) cobrir o capital próprio; null se nunca no horizonte de 50 anos. */
  paybackYears: number | null;
}

export interface UnderwritingResult {
  costs: PurchaseCostsResult;
  cashflow: AnnualCashflowResult;
  returns: ReturnMetricsResult;
}
