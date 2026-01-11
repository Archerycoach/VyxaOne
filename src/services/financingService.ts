// Financing Calculator Service

export interface FinancingParams {
  propertyValue: number;
  downPayment: number;
  interestRate: number;
  spread: number;
  loanTermYears: number;
  insurance?: number;
}

export interface FinancingResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

export const calculateMortgage = (params: FinancingParams): FinancingResult => {
  const { propertyValue, downPayment, interestRate, spread, loanTermYears } = params;
  
  const principal = propertyValue - downPayment;
  const totalRate = interestRate + spread; // Euribor + Spread
  const monthlyRate = totalRate / 100 / 12;
  const numberOfPayments = loanTermYears * 12;

  // Formula: M = P * (r * (1 + r)^n) / ((1 + r)^n - 1)
  let monthlyPayment = 0;
  
  if (monthlyRate === 0) {
    monthlyPayment = principal / numberOfPayments;
  } else {
    monthlyPayment = principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  const schedule = [];
  let remainingBalance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= numberOfPayments; i++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    
    remainingBalance -= principalPayment;
    if (remainingBalance < 0) remainingBalance = 0;
    
    totalInterest += interestPayment;

    // Only store first few years and yearly summaries to save memory if needed
    // For now storing all for detail view
    schedule.push({
      month: i,
      payment: monthlyPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance: remainingBalance
    });
  }

  return {
    monthlyPayment,
    totalPayment: principal + totalInterest,
    totalInterest,
    schedule
  };
};

export const calculateExtraCosts = (propertyValue: number) => {
  // Portugal specific estimates
  const imt = calculateIMT(propertyValue);
  const stampDuty = propertyValue * 0.008; // 0.8%
  const deed = 375; // Approx notary cost
  const registry = 250; // Approx registry
  
  return {
    imt,
    stampDuty,
    deed,
    registry,
    total: imt + stampDuty + deed + registry
  };
};

const calculateIMT = (value: number): number => {
  // Simplified IMT 2024 table for HPP (Habitação Própria Permanente)
  if (value <= 101917) return 0;
  if (value <= 139412) return (value * 0.02) - 2038.34;
  if (value <= 186941) return (value * 0.05) - 6220.66;
  if (value <= 316772) return (value * 0.07) - 9959.45;
  if (value <= 633453) return (value * 0.08) - 13127.13;
  return value * 0.06; // Single rate > 633k (simplified, usually 6% flat above 1.1M)
};