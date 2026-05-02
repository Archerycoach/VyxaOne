import { useState, useEffect } from "react";
import { AppWrapper } from "@/components/AppWrapper";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bot, FileText, Play, Clock, Plus, Loader2, Calendar, Settings, Trash2 } from "lucide-react";
import Link from "next/link";

interface Report {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface AiTask {
  id: string;
  title: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
}

export default function AiAgentPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  // Create task modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", system_prompt: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [reportsRes, tasksRes] = await Promise.all([
        (supabase.from("ai_reports" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }) as unknown as Promise<{ data: Report[] }>),
        (supabase.from("ai_tasks" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }) as unknown as Promise<{ data: AiTask[] }>)
      ]);

      if (reportsRes.data) setReports(reportsRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados da IA:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgent = async (taskId?: string) => {
    try {
      setRunningTaskId(taskId || "default");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await fetch("/api/gpt/manual-run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ task_id: taskId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Erro ao executar agente");

      toast({
        title: "Análise Concluída",
        description: "O relatório foi gerado e guardado com sucesso.",
      });

      loadData(); // Recarregar relatórios
    } catch (error: any) {
      toast({
        title: "Erro na Execução",
        description: error.message || "Erro desconhecido. Verifique se a sua Chave OpenAI está configurada nas Definições.",
        variant: "destructive"
      });
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from("ai_tasks" as any).insert({
        user_id: user.id,
        title: newTask.title,
        description: newTask.description,
        system_prompt: newTask.system_prompt
      }) as any);

      if (error) throw error;

      toast({ title: "Rotina Criada", description: "A rotina foi gravada com sucesso." });
      setIsTaskModalOpen(false);
      setNewTask({ title: "", description: "", system_prompt: "" });
      loadData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const { error } = await (supabase.from("ai_tasks" as any).delete().eq("id", id) as any);
      if (error) throw error;
      toast({ title: "Rotina Eliminada" });
      loadData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <ProtectedRoute>
      <AppWrapper>
        <SEO title="Agente IA" description="O seu assistente imobiliário pessoal" />
        <Layout>
          <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Bot className="h-8 w-8 text-indigo-600" />
                  Agente IA
                </h1>
                <p className="text-gray-500 mt-1">O seu assistente virtual para análise de leads e gestão de calendário.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/settings?tab=gpt">
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Chave OpenAI
                  </Button>
                </Link>
                <Button 
                  onClick={() => handleRunAgent()} 
                  disabled={runningTaskId !== null}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  {runningTaskId === "default" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Resumo Geral Agora
                </Button>
              </div>
            </div>

            <Tabs defaultValue="reports" className="w-full">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
                <TabsTrigger value="reports">Relatórios Diários</TabsTrigger>
                <TabsTrigger value="routines">Rotinas do Agente</TabsTrigger>
              </TabsList>
              
              <TabsContent value="reports" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Relatórios</CardTitle>
                    <CardDescription>Consulte todas as análises passadas geradas pelo GPT.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : reports.length === 0 ? (
                      <div className="text-center p-8 border border-dashed rounded-lg bg-gray-50 text-gray-500">
                        Ainda não existem relatórios. Execute o agente ou aguarde pelo agendamento diário.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reports.map(report => (
                          <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-3">
                              <FileText className="h-5 w-5 text-indigo-500 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-gray-900">{report.title}</h4>
                                <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(report.created_at).toLocaleString('pt-PT')}
                                </span>
                              </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setSelectedReport(report)}>
                              Ler
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="routines" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                      <CardTitle>Rotinas Personalizadas</CardTitle>
                      <CardDescription>Crie tarefas específicas para o agente analisar (ex: Apenas Leads Frias).</CardDescription>
                    </div>
                    <Button onClick={() => setIsTaskModalOpen(true)} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" /> Nova Rotina
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : tasks.length === 0 ? (
                      <div className="text-center p-8 border border-dashed rounded-lg bg-gray-50 text-gray-500">
                        Crie rotinas específicas para o seu Agente analisar os dados de forma diferente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tasks.map(task => (
                          <div key={task.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900">{task.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                onClick={() => handleRunAgent(task.id)}
                                disabled={runningTaskId !== null}
                                size="sm"
                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 gap-2"
                              >
                                {runningTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Executar Rotina
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </Layout>

        {/* Modal Ler Relatório */}
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700 border-b pb-4">
                <Bot className="h-5 w-5" />
                {selectedReport?.title}
              </DialogTitle>
            </DialogHeader>
            <div 
              className="mt-4 text-sm text-gray-800 leading-relaxed prose prose-indigo max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedReport?.content || "" }}
            />
          </DialogContent>
        </Dialog>

        {/* Modal Nova Rotina */}
        <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Rotina do Agente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome da Rotina</label>
                <Input 
                  placeholder="Ex: Análise de Leads Perdidas" 
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição Breve</label>
                <Input 
                  placeholder="O que faz esta rotina?" 
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Instruções para o GPT (Prompt)</label>
                <Textarea 
                  rows={5}
                  placeholder="Ex: És um especialista em recuperar leads frias. Analisa as notas e escreve e-mails de recuperação..." 
                  value={newTask.system_prompt}
                  onChange={(e) => setNewTask({...newTask, system_prompt: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">O sistema vai adicionar os dados das leads automaticamente a estas instruções.</p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateTask} disabled={!newTask.title || !newTask.system_prompt}>
                Guardar Rotina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppWrapper>
    </ProtectedRoute>
  );
}