import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { OffPlanProjection } from "@/lib/offPlanProjection";

interface Source {
  indicator: string;
  name: string;
  quarters: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  regionalNote: string | null;
}

interface Risk {
  negativeQuarters: number;
  totalQuarters: number;
  worstYoyPct: number;
}

interface OffPlanProjectionCardProps {
  /** Preço atual (valor de compra na planta, ou valor central da avaliação). */
  currentPrice: number | null;
  /** Data prevista de conclusão. Se não vier, o cartão pede-a. */
  deliveryDate?: string | null;
  municipality?: string | null;
  freguesia?: string | null;
}

const eur = (v: number) => `${Math.round(v).toLocaleString("pt-PT")} €`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",")}%`;

/**
 * Projeção da valorização até à conclusão da obra, para imóveis em planta.
 *
 * Assente no Índice de Preços da Habitação do INE, categoria "Novos" — e
 * mostra sempre três cenários com a respetiva base, mais o histórico de
 * trimestres negativos. Uma projeção sem intervalo e sem fonte seria uma
 * promessa; isto é uma estimativa que o consultor consegue justificar.
 */
export function OffPlanProjectionCard({
  currentPrice,
  deliveryDate,
  municipality,
  freguesia,
}: OffPlanProjectionCardProps) {
  const [date, setDate] = useState(deliveryDate || "");
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<OffPlanProjection | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    if (deliveryDate) setDate(deliveryDate);
  }, [deliveryDate]);

  const load = useCallback(async () => {
    if (!currentPrice || currentPrice <= 0 || !date) return;
    setLoading(true);
    setUnavailable(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/valuation/off-plan-projection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ currentPrice, deliveryDate: date, municipality, freguesia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao calcular");
      if (!data.available) {
        setProjection(null);
        setUnavailable(data.reason || "Projeção indisponível.");
        return;
      }
      setProjection(data.projection);
      setSource(data.source);
      setRisk(data.risk);
    } catch (error: any) {
      setProjection(null);
      setUnavailable(error.message || "Não foi possível calcular a projeção.");
    } finally {
      setLoading(false);
    }
  }, [currentPrice, date, municipality, freguesia]);

  useEffect(() => {
    if (date && currentPrice) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice, date]);

  if (!currentPrice || currentPrice <= 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Valorização estimada até à conclusão
        </CardTitle>
        <CardDescription>
          Projeção com base no Índice de Preços da Habitação do INE, na categoria de alojamentos{" "}
          <strong>novos</strong> — que valoriza a ritmo diferente dos usados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!deliveryDate && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Data prevista de conclusão</Label>
              <Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={!date || loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Calcular
            </Button>
          </div>
        )}

        {loading && !projection && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> A consultar o INE…
          </div>
        )}

        {unavailable && <p className="text-sm text-amber-700">{unavailable}</p>}

        {projection && (
          <>
            <p className="text-sm text-gray-600">
              Prazo considerado: <strong>{projection.years.toFixed(1).replace(".", ",")} anos</strong> · valor
              de partida <strong>{eur(projection.currentPrice)}</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {projection.scenarios.map((s) => (
                <div
                  key={s.key}
                  className={`rounded-lg border p-3 ${s.key === "central" ? "border-emerald-300 bg-emerald-50" : ""}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold mt-1">{eur(s.projectedValue)}</p>
                  <p className="text-sm text-emerald-700 font-medium">
                    +{eur(s.gainValue)} ({pct(s.gainPct)})
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                    {pct(s.effectiveAnnualRate)}/ano — {s.basis}
                  </p>
                </div>
              ))}
            </div>

            {source?.regionalNote && (
              <p className="text-xs text-gray-600">{source.regionalNote}</p>
            )}

            {risk && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>
                    <strong>Isto é uma projeção, não uma garantia.</strong> Na série do INE,{" "}
                    {risk.negativeQuarters} dos {risk.totalQuarters} trimestres tiveram valorização{" "}
                    <strong>negativa</strong> (o pior a {risk.worstYoyPct.toFixed(1).replace(".", ",")}%). Um
                    imóvel entregue durante uma correção de mercado pode valer menos do que custou.
                  </p>
                  <p>
                    Não está incluída a subida de preços que o próprio promotor pratica à medida que vende e a
                    obra avança — essa é política comercial dele, não índice de mercado.
                  </p>
                </div>
              </div>
            )}

            {source && (
              <p className="text-[11px] text-gray-400">
                Fonte: {source.name} · indicador {source.indicator} · série de {source.quarters} trimestres
                {source.firstPeriod ? ` (${source.firstPeriod}` : ""}
                {source.lastPeriod ? ` a ${source.lastPeriod})` : source.firstPeriod ? ")" : ""}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
