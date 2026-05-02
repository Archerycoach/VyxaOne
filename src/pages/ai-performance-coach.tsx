import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Sparkles, Brain, TrendingUp, Target, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AiPerformanceCoach() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [frequency, setFrequency] = useState("manual");
  const { toast } = useToast();

  const handleFrequencyChange = (val: string) => {
    setFrequency(val);
    toast({
      title: "Preferência guardada",
      description: `O Coach de Performance IA foi configurado para correr: ${val === 'daily' ? 'Diariamente' : val === 'weekly' ? 'Semanalmente' : 'Apenas Manualmente'}.`
    });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Não autenticado");

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
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errMsg;
        } catch (e) {
          errMsg = `Erro ${response.status}: Ocorreu um problema no servidor.`;
          console.error("Non-JSON error response:", errText);
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      setAnalysisResult(data.advice);
      
      toast({
        title: "Análise concluída",
        description: "Os seus conselhos preditivos foram gerados com sucesso.",
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro na análise",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Layout title="Coach de Performance IA">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Brain className="h-6 w-6 text-emerald-600" />
              O Seu Coach de Performance
            </h1>
            <p className="text-slate-600 mt-1">
              Avalio as suas taxas de conversão e negócios fechados para lhe dar conselhos práticos e diretos sobre como bater as metas deste mês.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px]">
            <Button 
              size="lg" 
              onClick={runAnalysis} 
              disabled={isAnalyzing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md w-full"
            >
              {isAnalyzing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> A calcular...</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" /> Obter Conselhos</>
              )}
            </Button>
            <Select value={frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger className="bg-white/80 border-emerald-200 text-sm h-9">
                <SelectValue placeholder="Frequência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Apenas Manualmente</SelectItem>
                <SelectItem value="daily">Diariamente (Notificação)</SelectItem>
                <SelectItem value="weekly">Semanalmente (Notificação)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {analysisResult ? (
          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="bg-emerald-50/50 border-b border-emerald-50">
              <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
                <Bot className="h-5 w-5 text-emerald-600" />
                Diagnóstico e Conselho Preditivo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="prose max-w-none text-slate-700">
                {analysisResult.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-2">{paragraph}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/50 border-dashed">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Taxa de Conversão</h3>
                <p className="text-sm text-slate-500">Calcula a percentagem de leads que se transformam em negócios fechados.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/50 border-dashed">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Projeção de Objetivos</h3>
                <p className="text-sm text-slate-500">Diz-lhe exatamente quantos leads tem de contactar hoje para atingir a meta mensal.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 border-dashed">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-12 w-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                  <Brain className="h-6 w-6 text-rose-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Gargalos no Funil</h3>
                <p className="text-sm text-slate-500">Identifica em que fase do pipeline os seus clientes costumam desistir.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}