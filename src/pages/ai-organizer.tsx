import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Sparkles,
  ListTodo,
  Calendar,
  Loader2,
  CheckCircle2,
  Clock,
  PhoneCall,
  Flame,
  ClipboardCheck,
  PartyPopper,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { completeTask } from "@/services/tasksService";

interface TaskItem {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  related_lead_id: string | null;
}

interface EventItem {
  id: string;
  title: string;
  start_time: string;
  event_type: string | null;
  lead_id: string | null;
}

interface FollowUpLeadItem {
  id: string;
  name: string;
  next_follow_up: string | null;
  temperature: string | null;
  phone: string | null;
  email: string | null;
}

interface HotLeadItem {
  id: string;
  name: string;
  last_contact_date: string | null;
  phone: string | null;
  email: string | null;
}

interface QualificationGapItem {
  id: string;
  name: string;
  missing: { key: string; label: string }[];
  total: number;
  filled: number;
}

interface OrganizerData {
  summary: string;
  overdueTasks: TaskItem[];
  todayTasks: TaskItem[];
  todayEvents: EventItem[];
  followUpDueLeads: FollowUpLeadItem[];
  hotLeadsStale: HotLeadItem[];
  qualificationGaps: QualificationGapItem[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  medium: "bg-blue-100 text-blue-700 border-blue-300",
  low: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function AiOrganizer() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<OrganizerData | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const fetchOrganizerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Não autenticado - Inicie sessão novamente.");

      const response = await fetch("/api/gpt/agents/organizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = "Falha ao carregar o seu dia";
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
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrganizerData();
  }, [fetchOrganizerData]);

  const goToLead = (leadId: string | null | undefined) => {
    if (!leadId) return;
    router.push(`/leads?leadId=${leadId}`);
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await completeTask(taskId);
      toast({ title: "✅ Tarefa concluída" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              overdueTasks: prev.overdueTasks.filter((t) => t.id !== taskId),
              todayTasks: prev.todayTasks.filter((t) => t.id !== taskId),
            }
          : prev
      );
    } catch (error: any) {
      toast({ title: "Erro ao concluir tarefa", description: error.message, variant: "destructive" });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const totalItems = data
    ? data.overdueTasks.length +
      data.todayTasks.length +
      data.todayEvents.length +
      data.followUpDueLeads.length +
      data.hotLeadsStale.length +
      data.qualificationGaps.length
    : 0;

  return (
    <ProtectedRoute>
      <Layout title="O Meu Dia">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ListTodo className="h-6 w-6 text-blue-600" />
                O Meu Dia
              </h1>
              <p className="text-slate-600 mt-1">
                Tudo o que precisa de atenção hoje, num só sítio — clique em qualquer item para agir.
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={fetchOrganizerData}
              disabled={isLoading}
              className="bg-white/80 border-blue-200 shrink-0"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A atualizar...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Atualizar</>
              )}
            </Button>
          </div>

          {isLoading && !data && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Bot className="h-10 w-10 text-indigo-400 animate-pulse" />
              <p className="text-sm text-indigo-600">A analisar tarefas, agenda e leads...</p>
            </div>
          )}

          {data && (
            <>
              {data.summary && (
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <CardContent className="pt-6 flex items-start gap-3">
                    <Bot className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-slate-800">{data.summary}</p>
                  </CardContent>
                </Card>
              )}

              {totalItems === 0 && (
                <Card className="border-emerald-200">
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2 py-10">
                    <PartyPopper className="h-10 w-10 text-emerald-500" />
                    <p className="font-semibold text-slate-800">Está tudo em dia!</p>
                    <p className="text-sm text-slate-500">Sem tarefas atrasadas, eventos ou leads a precisar de atenção agora.</p>
                  </CardContent>
                </Card>
              )}

              {data.overdueTasks.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-700">
                      <Clock className="h-4 w-4" /> Tarefas Atrasadas ({data.overdueTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.overdueTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 bg-red-50/50 border border-red-100 rounded-lg p-3">
                        <div className="min-w-0">
                          <button
                            className="text-sm font-medium text-slate-800 hover:underline text-left truncate block"
                            onClick={() => goToLead(task.related_lead_id)}
                            disabled={!task.related_lead_id}
                          >
                            {task.title}
                          </button>
                          <div className="flex items-center gap-2 mt-1">
                            {task.due_date && (
                              <span className="text-xs text-red-600">
                                Venceu {new Date(task.due_date).toLocaleDateString("pt-PT")}
                              </span>
                            )}
                            {task.priority && (
                              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[task.priority] || ""}`}>
                                {task.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={completingTaskId === task.id}
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          {completingTaskId === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(data.todayTasks.length > 0 || data.todayEvents.length > 0) && (
                <Card className="border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                      <Calendar className="h-4 w-4" /> Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.todayEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between gap-3 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                        <div className="min-w-0">
                          <button
                            className="text-sm font-medium text-slate-800 hover:underline text-left truncate block"
                            onClick={() => goToLead(event.lead_id)}
                            disabled={!event.lead_id}
                          >
                            {event.title}
                          </button>
                          <span className="text-xs text-blue-600">
                            {new Date(event.start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                            {event.event_type ? ` · ${event.event_type}` : ""}
                          </span>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">Evento</Badge>
                      </div>
                    ))}
                    {data.todayTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 bg-blue-50/30 border border-blue-100 rounded-lg p-3">
                        <div className="min-w-0">
                          <button
                            className="text-sm font-medium text-slate-800 hover:underline text-left truncate block"
                            onClick={() => goToLead(task.related_lead_id)}
                            disabled={!task.related_lead_id}
                          >
                            {task.title}
                          </button>
                          {task.priority && (
                            <Badge variant="outline" className={`text-[10px] mt-1 ${PRIORITY_COLORS[task.priority] || ""}`}>
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={completingTaskId === task.id}
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          {completingTaskId === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.followUpDueLeads.length > 0 && (
                <Card className="border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                      <PhoneCall className="h-4 w-4" /> Leads para Retomar Contacto ({data.followUpDueLeads.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.followUpDueLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => goToLead(lead.id)}
                        className="w-full flex items-center justify-between gap-3 bg-purple-50/50 border border-purple-100 rounded-lg p-3 text-left hover:bg-purple-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                          {lead.next_follow_up && (
                            <span className="text-xs text-purple-600">
                              Previsto para {new Date(lead.next_follow_up).toLocaleDateString("pt-PT")}
                            </span>
                          )}
                        </div>
                        {lead.temperature && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {lead.temperature === "hot" ? "🔥 Quente" : lead.temperature === "warm" ? "☀️ Morna" : "❄️ Fria"}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.hotLeadsStale.length > 0 && (
                <Card className="border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                      <Flame className="h-4 w-4" /> Leads Quentes a Arrefecer ({data.hotLeadsStale.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.hotLeadsStale.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => goToLead(lead.id)}
                        className="w-full flex items-center justify-between gap-3 bg-orange-50/50 border border-orange-100 rounded-lg p-3 text-left hover:bg-orange-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                        <span className="text-xs text-orange-600 shrink-0">
                          {lead.last_contact_date
                            ? `Último contacto: ${new Date(lead.last_contact_date).toLocaleDateString("pt-PT")}`
                            : "Sem contacto registado"}
                        </span>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.qualificationGaps.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                      <ClipboardCheck className="h-4 w-4" /> Quase Qualificadas ({data.qualificationGaps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.qualificationGaps.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => goToLead(lead.id)}
                        className="w-full flex items-center justify-between gap-3 bg-amber-50/50 border border-amber-100 rounded-lg p-3 text-left hover:bg-amber-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                          <span className="text-xs text-amber-700">
                            {lead.filled}/{lead.total} preenchido — falta{lead.missing.length === 1 ? "" : "m"}{" "}
                            {lead.missing.map((m) => m.label).join(", ")}
                          </span>
                        </div>
                        <Badge className="bg-amber-600 shrink-0">{lead.missing.length}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
