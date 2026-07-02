import React, { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Brain, TrendingUp, Target, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PeriodProgress {
  revenueTarget: number | null;
  revenueAchieved: number;
  revenuePercentage: number | null;
  acquisitionsTarget: number | null;
  acquisitionsAchieved: number;
}

interface CoachData {
  summary: string;
  annual: PeriodProgress;
  semester: PeriodProgress;
  funnelCounts: Record<string, number>;
  totalActiveLeads: number;
  conversionRate: number;
  bottleneck: { key: string; label: string; count: number } | null;
  leadsNeededPerWeek: number | null;
}

const euro = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function ProgressCard({ title, progress }: { title: string; progress: PeriodProgress }) {
  const hasTarget = progress.revenueTarget !== null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasTarget ? (
          <>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Faturação</span>
                <span className="font-medium text-slate-800">
                  {euro(progress.revenueAchieved)} / {euro(progress.revenueTarget!)}
                </span>
              </div>
              <Progress value={Math.min(100, progress.revenuePercentage || 0)} />
              <span className="text-xs text-slate-500">{progress.revenuePercentage}% da meta</span>
            </div>
            {progress.acquisitionsTarget !== null && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Negócios fechados</span>
                  <span className="font-medium text-slate-800">
                    {progress.acquisitionsAchieved} / {progress.acquisitionsTarget}
                  </span>
                </div>
                <Progress value={Math.min(100, (progress.acquisitionsAchieved / progress.acquisitionsTarget) * 100)} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">Sem meta definida para este período. Configure em Definições.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiPerformanceCoach() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CoachData | null>(null);

  const fetchCoachData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Não autenticado - Inicie sessão novamente.");

      const response = await fetch("/api/gpt/agents/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = "Falha ao gerar análise";
        try {
          errMsg = JSON.parse(errText).error || errMsg;
        } catch {
          // resposta não-JSON, mantém mensagem genérica
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      setData(result);
    } catch (error: any) {
      toast({ title: "Erro na análise", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCoachData();
  }, [fetchCoachData]);

  return (
    <ProtectedRoute>
      <Layout title="Coach de Performance IA">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-100">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Brain className="h-6 w-6 text-emerald-600" />
                O Seu Coach de Performance
              </h1>
              <p className="text-slate-600 mt-1">
                Progresso real das suas metas, taxa de conversão e onde estão as suas leads presas — com um conselho direto sobre onde focar esta semana.
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={fetchCoachData}
              disabled={isLoading}
              className="bg-white/80 border-emerald-200 shrink-0"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A calcular...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Atualizar</>
              )}
            </Button>
          </div>

          {isLoading && !data && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Brain className="h-10 w-10 text-emerald-400 animate-pulse" />
              <p className="text-sm text-emerald-600">A calcular metas, conversão e gargalos...</p>
            </div>
          )}

          {data && (
            <>
              {data.summary && (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-6 flex items-start gap-3">
                    <Bot className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-slate-800">{data.summary}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProgressCard title="Meta do Semestre" progress={data.semester} />
                <ProgressCard title="Meta do Ano" progress={data.annual} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Taxa de Conversão</h3>
                    <p className="text-2xl font-bold text-purple-700">{data.conversionRate}%</p>
                    <p className="text-xs text-slate-500">de todas as leads que já passaram pelo funil</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Target className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Ritmo Necessário</h3>
                    {data.leadsNeededPerWeek !== null ? (
                      <>
                        <p className="text-2xl font-bold text-blue-700">{data.leadsNeededPerWeek}</p>
                        <p className="text-xs text-slate-500">leads qualificadas / semana para bater a meta</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 pt-2">Sem dados suficientes para calcular</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="h-12 w-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                      <AlertTriangle className="h-6 w-6 text-rose-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Gargalo no Funil</h3>
                    {data.bottleneck ? (
                      <>
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 mt-1">
                          {data.bottleneck.label} · {data.bottleneck.count} leads
                        </Badge>
                        <p className="text-xs text-slate-500 pt-1">É onde tem mais leads à espera de avançar</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 pt-2">Sem gargalo evidente</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
