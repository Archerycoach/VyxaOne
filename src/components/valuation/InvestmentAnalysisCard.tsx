import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";
import { buildDefaultAssumptions } from "@/lib/underwriting/assumptions";
import { runUnderwriting } from "@/lib/underwriting/engine";
import { IMT_TABLE_YEAR } from "@/lib/underwriting/imt";
import type { UnderwritingAssumptions } from "@/lib/underwriting/types";

interface InvestmentAnalysisCardProps {
  /** Valor central sugerido pela avaliação — ponto de partida do preço de compra. */
  suggestedPrice: number | null;
  /** Área do imóvel (m²), para estimar a renda pela referência do INE. */
  area: number | null;
  /** Renda mediana €/m²/mês (INE, novos contratos) — null se indisponível. */
  ineRentPerSqm: number | null;
}

const eur = (v: number) =>
  `${Math.round(v).toLocaleString("pt-PT")} €`;
const pct = (v: number, decimals = 1) =>
  `${(v * 100).toFixed(decimals).replace(".", ",")}%`;

/**
 * Análise de investimento sobre o resultado da avaliação — cálculo local e
 * imediato (motor puro em src/lib/underwriting), pressupostos todos editáveis.
 * A renda por omissão vem da referência de rendas do INE já usada no CMA;
 * sem ela, usa uma yield bruta típica de 5,5% como aproximação inicial.
 */
export function InvestmentAnalysisCard({ suggestedPrice, area, ineRentPerSqm }: InvestmentAnalysisCardProps) {
  const defaultPrice = suggestedPrice && suggestedPrice > 0 ? Math.round(suggestedPrice) : 0;
  const defaultRent = useMemo(() => {
    if (ineRentPerSqm && area && area > 0) return Math.round(ineRentPerSqm * area);
    if (defaultPrice > 0) return Math.round((defaultPrice * 0.055) / 12);
    return 0;
  }, [ineRentPerSqm, area, defaultPrice]);

  const [ltvPct, setLtvPct] = useState(70);
  const [a, setA] = useState<UnderwritingAssumptions>(() =>
    buildDefaultAssumptions({ price: defaultPrice, monthlyRent: defaultRent, ltv: 0.7 })
  );

  // Nova avaliação gerada → repor os pressupostos nos novos valores por
  // omissão (sem isto o cartão mostrava os números da avaliação anterior).
  useEffect(() => {
    setA(buildDefaultAssumptions({ price: defaultPrice, monthlyRent: defaultRent, ltv: ltvPct / 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPrice, defaultRent]);

  const setPurchase = (patch: Partial<UnderwritingAssumptions["purchase"]>) =>
    setA((prev) => ({ ...prev, purchase: { ...prev.purchase, ...patch } }));
  const setRental = (patch: Partial<UnderwritingAssumptions["rental"]>) =>
    setA((prev) => ({ ...prev, rental: { ...prev.rental, ...patch } }));
  const setExit = (patch: Partial<UnderwritingAssumptions["exit"]>) =>
    setA((prev) => ({ ...prev, exit: { ...prev.exit, ...patch } }));

  const onPriceChange = (price: number) => {
    setA((prev) => ({
      ...prev,
      purchase: { ...prev.purchase, price, loanAmount: Math.round((price * ltvPct) / 100) },
    }));
  };
  const onLtvChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setLtvPct(clamped);
    setA((prev) => ({
      ...prev,
      purchase: { ...prev.purchase, loanAmount: Math.round((prev.purchase.price * clamped) / 100) },
    }));
  };

  const result = useMemo(() => runUnderwriting(a), [a]);

  const num = (v: string) => {
    const parsed = Number(v.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  if (defaultPrice <= 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Análise de Investimento
        </CardTitle>
        <CardDescription>
          Para compradores investidores: custos de compra, cash-flow de arrendamento e retorno.
          Pressupostos editáveis — os valores iniciais vêm da avaliação{ineRentPerSqm ? " e da renda mediana do INE para a zona" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pressupostos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Compra</p>
            <div className="space-y-1">
              <Label className="text-xs">Preço de aquisição (€)</Label>
              <Input type="number" value={a.purchase.price} onChange={(e) => onPriceChange(num(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Financiamento (%)</Label>
                <Input type="number" value={ltvPct} onChange={(e) => onLtvChange(num(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa juro (%)</Label>
                <Input
                  type="number" step="0.1" value={+(a.purchase.loanInterestRate * 100).toFixed(2)}
                  onChange={(e) => setPurchase({ loanInterestRate: num(e.target.value) / 100 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo (anos)</Label>
                <Input type="number" value={a.purchase.loanTermYears} onChange={(e) => setPurchase({ loanTermYears: num(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Regime IMT</Label>
                <Select value={a.purchase.regime} onValueChange={(v) => setPurchase({ regime: v as "hpp" | "secundaria" })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secundaria">Secundária / investimento</SelectItem>
                    <SelectItem value="hpp">Habitação própria permanente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Arrendamento</p>
            <div className="space-y-1">
              <Label className="text-xs">Renda mensal (€)</Label>
              <Input type="number" value={a.rental.monthlyRent} onChange={(e) => setRental({ monthlyRent: num(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Vacância (%)</Label>
                <Input type="number" value={+(a.rental.vacancyRate * 100).toFixed(1)} onChange={(e) => setRental({ vacancyRate: num(e.target.value) / 100 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condomínio (€/mês)</Label>
                <Input type="number" value={a.rental.monthlyCondoFee} onChange={(e) => setRental({ monthlyCondoFee: num(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IMI (€/ano)</Label>
                <Input type="number" value={a.rental.annualImi} onChange={(e) => setRental({ annualImi: num(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IRS rendas (%)</Label>
                <Input type="number" value={+(a.rental.rentalIncomeTaxRate * 100).toFixed(1)} onChange={(e) => setRental({ rentalIncomeTaxRate: num(e.target.value) / 100 })} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Horizonte e saída</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Horizonte (anos)</Label>
                <Input type="number" value={a.exit.holdYears} onChange={(e) => setExit({ holdYears: Math.max(1, Math.round(num(e.target.value))) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valorização (%/ano)</Label>
                <Input type="number" step="0.1" value={+(a.exit.annualAppreciation * 100).toFixed(1)} onChange={(e) => setExit({ annualAppreciation: num(e.target.value) / 100 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custos de venda (%)</Label>
                <Input type="number" step="0.1" value={+(a.exit.sellingCostsRate * 100).toFixed(1)} onChange={(e) => setExit({ sellingCostsRate: num(e.target.value) / 100 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manutenção (% renda)</Label>
                <Input type="number" step="0.5" value={+(a.rental.maintenanceRate * 100).toFixed(1)} onChange={(e) => setRental({ maintenanceRate: num(e.target.value) / 100 })} />
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Yield bruta</p>
            <p className="text-xl font-bold">{pct(result.returns.grossYield)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Yield líquida (NOI)</p>
            <p className="text-xl font-bold">{pct(result.returns.netYield)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Cash-on-cash</p>
            <p className="text-xl font-bold">{pct(result.returns.cashOnCash)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">TIR a {a.exit.holdYears} anos</p>
            <p className="text-xl font-bold">{result.returns.irr !== null ? pct(result.returns.irr) : "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-gray-50 p-4 space-y-1">
            <p className="font-semibold text-gray-700 mb-2">Custos de aquisição</p>
            <div className="flex justify-between"><span className="text-gray-600">IMT ({IMT_TABLE_YEAR})</span><span>{eur(result.costs.imt)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Imposto do selo (compra)</span><span>{eur(result.costs.stampDutyPurchase)}</span></div>
            {result.costs.stampDutyLoan > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Imposto do selo (crédito)</span><span>{eur(result.costs.stampDutyLoan)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-600">Escritura e registos</span><span>{eur(result.costs.notaryAndRegistration)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Investimento total</span><span>{eur(result.costs.totalInvestment)}</span></div>
            <div className="flex justify-between font-semibold text-blue-700"><span>Capital próprio</span><span>{eur(result.costs.equityRequired)}</span></div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 space-y-1">
            <p className="font-semibold text-gray-700 mb-2">Cash-flow anual</p>
            <div className="flex justify-between"><span className="text-gray-600">Renda efetiva (c/ vacância)</span><span>{eur(result.cashflow.effectiveAnnualRent)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Custos operacionais</span><span>-{eur(result.cashflow.operatingCosts)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>NOI</span><span>{eur(result.cashflow.noi)}</span></div>
            {result.cashflow.annualDebtService > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Serviço da dívida</span><span>-{eur(result.cashflow.annualDebtService)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-600">IRS (cat. F)</span><span>-{eur(result.cashflow.incomeTax)}</span></div>
            <div className={`flex justify-between font-semibold border-t pt-1 mt-1 ${result.cashflow.cashflowAfterTax >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              <span>Cash-flow após impostos</span><span>{eur(result.cashflow.cashflowAfterTax)}</span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 space-y-1">
            <p className="font-semibold text-gray-700 mb-2">Notas</p>
            <p className="text-gray-600 text-xs leading-relaxed">
              Payback do capital próprio: {result.returns.paybackYears !== null ? `${String(result.returns.paybackYears).replace(".", ",")} anos` : "não recuperável só com o cash-flow no horizonte considerado"}.
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              Renda constante ao longo do horizonte (conservador). IMI estimado — confirmar com a caderneta e a taxa do município.
              Valores indicativos, não constituem aconselhamento financeiro.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
