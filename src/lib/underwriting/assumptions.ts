import type { UnderwritingAssumptions } from "./types";

/**
 * Pressupostos por omissão da análise de investimento — todos editáveis na UI.
 * Valores conservadores para o mercado português; o consultor ajusta ao caso.
 */
export function buildDefaultAssumptions(params: {
  price: number;
  monthlyRent: number;
  /** Fração financiada (0.7 = 70% LTV). 0 para compra a pronto. */
  ltv?: number;
}): UnderwritingAssumptions {
  const { price, monthlyRent, ltv = 0.7 } = params;
  const loanAmount = Math.round(price * ltv);

  return {
    purchase: {
      price,
      // Investimento = por regra não é habitação própria permanente.
      regime: "secundaria",
      notaryAndRegistration: 1200,
      loanAmount,
      loanInterestRate: 0.038,
      loanTermYears: 30,
    },
    rental: {
      monthlyRent,
      vacancyRate: 0.08, // ~1 mês/ano
      monthlyCondoFee: Math.round(Math.max(20, price * 0.0003) / 5) * 5, // heurística editável
      annualInsurance: 250,
      maintenanceRate: 0.05,
      managementRate: 0, // gerido pelo próprio por omissão
      // IMI: VPT tipicamente abaixo do preço de mercado; aproximação editável
      // (60% do preço × taxa média 0,35%).
      annualImi: Math.round(price * 0.6 * 0.0035),
      rentalIncomeTaxRate: 0.25, // taxa especial cat. F (contratos ≥ 2 anos: menor)
    },
    exit: {
      holdYears: 10,
      annualAppreciation: 0.02,
      sellingCostsRate: 0.055, // mediação 5% + encargos
    },
  };
}
