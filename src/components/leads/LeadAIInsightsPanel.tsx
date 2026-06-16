import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, AlertCircle, TrendingUp, Target, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIInsights {
  summary: string;
  sentiment: string;
  temperature: string;
  next_best_action: string;
  pain_points: string[];
}

export function LeadAIInsightsPanel({ leadId }: { leadId: string }) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/gpt/leads/${leadId}/insights`, {
        headers: { "Authorization": `Bearer ${session?.access_token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao gerar insights");
      }
      
      const data = await res.json();
      setInsights(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="relative">
          <Bot className="h-12 w-12 text-indigo-500 animate-pulse" />
          <Sparkles className="h-5 w-5 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
        </div>
        <p className="text-sm font-medium text-indigo-600">A processar o histórico e comportamento da lead...</p>
        <p className="text-xs text-muted-foreground">A IA está a analisar as notas e interações.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg flex flex-col items-center text-center gap-3 mt-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <div>
          <p className="font-semibold text-lg">Não foi possível gerar a análise</p>
          <p className="text-sm mt-1 max-w-md mx-auto">{error}</p>
          <Button variant="outline" className="mt-4 bg-white" onClick={fetchInsights}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const getTemperatureColor = (temp: string) => {
    const t = temp.toLowerCase();
    if (t.includes('quente')) return 'bg-red-50 text-red-700 border-red-200';
    if (t.includes('morn')) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getSentimentColor = (sent: string) => {
    const s = sent.toLowerCase();
    if (s.includes('positiv')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('negativ')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-indigo-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-100 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-full">
              <Bot className="h-5 w-5 text-indigo-700" />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900">Análise Estratégica IA</h3>
              <p className="text-xs text-indigo-600/80">Gerado em tempo real com base no CRM</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={`px-3 py-1 ${getTemperatureColor(insights.temperature)}`}>
              Temperatura: {insights.temperature}
            </Badge>
            <Badge variant="outline" className={`px-3 py-1 ${getSentimentColor(insights.sentiment)}`}>
              Sentimento: {insights.sentiment}
            </Badge>
          </div>
        </div>
        
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Esquerda: Resumo e Dores */}
            <div className="p-6 space-y-6 bg-white">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Ponto de Situação
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                  {insights.summary}
                </p>
              </div>

              {insights.pain_points && insights.pain_points.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                    <ListChecks className="h-4 w-4 text-rose-500" />
                    Objeções / Pontos de Atenção
                  </h4>
                  <ul className="space-y-2">
                    {insights.pain_points.map((point, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2 bg-rose-50/30 p-2 rounded border border-rose-100/50">
                        <span className="text-rose-400 font-bold mt-0.5">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Direita: Call to Action */}
            <div className="p-6 bg-slate-50 flex flex-col justify-center">
              <div className="bg-white rounded-xl p-5 border-2 border-indigo-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-indigo-900 mb-3">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Próximo Passo Recomendado
                </h4>
                <p className="text-base text-gray-800 leading-relaxed font-medium">
                  {insights.next_best_action}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
         <Button variant="ghost" size="sm" onClick={fetchInsights} className="text-gray-500 hover:text-indigo-600">
            <Sparkles className="h-4 w-4 mr-2" />
            Atualizar Análise
         </Button>
      </div>
    </div>
  );
}