import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Sparkles, ListTodo, Calendar, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AiOrganizer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [frequency, setFrequency] = useState("manual");
  const { toast } = useToast();

  const handleFrequencyChange = (val: string) => {
    setFrequency(val);
    toast({
      title: "Preferência guardada",
      description: `O Organizador IA foi configurado para correr: ${val === 'daily' ? 'Diariamente' : val === 'weekly' ? 'Semanalmente' : 'Apenas Manualmente'}.`
    });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Não autenticado");

      const response = await fetch("/api/gpt/agents/organizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Falha ao gerar análise");
      }

      const data = await response.json();
      setAnalysisResult(data.advice);
      
      toast({
        title: "Organização concluída",
        description: "O seu plano de ação foi gerado com sucesso.",
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
    <Layout title="Organizador Pessoal IA">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ListTodo className="h-6 w-6 text-blue-600" />
              O Seu Organizador Pessoal
            </h1>
            <p className="text-slate-600 mt-1">
              Deixe a IA analisar a sua agenda, tarefas atrasadas e leads pendentes para lhe criar um plano de ação prioritário para hoje.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px]">
            <Button 
              size="lg" 
              onClick={runAnalysis} 
              disabled={isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full"
            >
              {isAnalyzing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> A analisar...</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" /> Organizar o meu dia</>
              )}
            </Button>
            <Select value={frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger className="bg-white/80 border-blue-200 text-sm h-9">
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
          <Card className="border-blue-100 shadow-md">
            <CardHeader className="bg-blue-50/50 border-b border-blue-50">
              <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
                <Bot className="h-5 w-5 text-blue-600" />
                Plano de Ação Sugerido
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
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Gestão de Agenda</h3>
                <p className="text-sm text-slate-500">Analisa eventos sobrepostos e prepara resumos para as próximas reuniões.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/50 border-dashed">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <ListTodo className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Priorização de Tarefas</h3>
                <p className="text-sm text-slate-500">Destaca as tarefas urgentes e atrasadas que precisam de atenção imediata.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 border-dashed">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Leads Esquecidos</h3>
                <p className="text-sm text-slate-500">Identifica potenciais clientes que arrefeceram por falta de seguimento.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}