import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateLeadConversionProbability, type ConversionProbabilityResult } from "@/services/predictiveScoringService";

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referência",
  social_media: "Redes Sociais",
  cold_call: "Prospeção",
  event: "Evento",
  meta: "Meta/Facebook Ads",
  idealista: "Idealista",
  other: "Outro",
};

const PURPOSE_LABELS: Record<string, string> = {
  housing: "Habitação própria",
  investment: "Investimento",
  secondary: "Habitação secundária",
};

export function LeadConversionProbabilityPanel({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<ConversionProbabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadStored = async () => {
    const { data } = await supabase
      .from("leads")
      .select("conversion_probability, conversion_probability_factors")
      .eq("id", leadId)
      .maybeSingle();
    if (data && (data as any).conversion_probability !== null) {
      setResult({
        probability: (data as any).conversion_probability,
        factors: (data as any).conversion_probability_factors,
        hasEnoughData: true,
      });
    }
    setInitialLoad(false);
  };

  useEffect(() => {
    loadStored();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fresh = await updateLeadConversionProbability(leadId, user.id);
      setResult(fresh);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) return null;

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-slate-600" />
            <h3 className="font-semibold text-sm text-slate-800">Probabilidade de Fecho</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRecalculate} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {!result || !result.hasEnoughData ? (
          <p className="text-xs text-gray-400">
            Ainda não há histórico suficiente (negócios fechados e perdidos) para calcular uma probabilidade fiável. Carregue no botão para tentar.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span
                className={
                  result.probability >= 60
                    ? "text-3xl font-bold text-emerald-600"
                    : result.probability >= 30
                      ? "text-3xl font-bold text-amber-600"
                      : "text-3xl font-bold text-red-600"
                }
              >
                {result.probability}%
              </span>
              <span className="text-xs text-gray-500">com base no seu histórico</span>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Origem ({SOURCE_LABELS[result.factors.source.value || ""] || result.factors.source.value || "—"})</span>
                <Badge variant="outline" className="text-[10px]">{result.factors.source.rate}%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Orçamento ({result.factors.budgetBucket.value})</span>
                <Badge variant="outline" className="text-[10px]">{result.factors.budgetBucket.rate}%</Badge>
              </div>
              {result.factors.buyPurpose.value && (
                <div className="flex justify-between">
                  <span>Objetivo ({PURPOSE_LABELS[result.factors.buyPurpose.value] || result.factors.buyPurpose.value})</span>
                  <Badge variant="outline" className="text-[10px]">{result.factors.buyPurpose.rate}%</Badge>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
