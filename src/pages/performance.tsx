import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { 
  Target, 
  Trophy, 
  TrendingUp, 
  DollarSign, 
  Award,
  Calendar,
  CheckSquare,
  Users,
  TrendingDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";

interface AgentMetrics {
  deals_closed: number;
  total_revenue: number;
  active_leads: number;
  conversion_rate: number;
  monthly_goal: number;
  goal_progress: number;
  tasks_completed: number;
  tasks_pending: number;
  meetings_this_week: number;
}

export default function Performance() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoadMetrics();
  }, []);

  const checkAuthAndLoadMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.push("/login");
        return;
      }

      setAgentName(profile.full_name || profile.email || "Agente");

      // Admin and team_lead should go to team-dashboard
      if (profile.role === "admin" || profile.role === "team_lead") {
        router.push("/team-dashboard");
        return;
      }

      await loadAgentMetrics(user.id);
    } catch (error) {
      console.error("Error loading metrics:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadAgentMetrics = async (userId: string) => {
    try {
      // Get leads for this agent
      const { data: leads } = await supabase
        .from("leads")
        .select("status")
        .eq("assigned_to", userId);

      const wonLeads = leads?.filter(l => l.status === "won").length || 0;
      const totalLeads = leads?.length || 0;
      const activeLeads = leads?.filter(l => !["won", "lost"].includes(l.status)).length || 0;
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      // Get tasks statistics
      const { data: tasks } = await supabase
        .from("tasks")
        .select("status")
        .eq("assigned_to", userId);

      const tasksCompleted = tasks?.filter(t => t.status === "completed").length || 0;
      const tasksPending = tasks?.filter(t => t.status === "pending").length || 0;

      // Get meetings this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const { data: meetings } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .gte("start_time", startOfWeek.toISOString())
        .lte("start_time", endOfWeek.toISOString());

      const monthlyGoal = 200000;
      const totalRevenue = wonLeads * 150000;

      setMetrics({
        deals_closed: wonLeads,
        total_revenue: totalRevenue,
        active_leads: activeLeads,
        conversion_rate: Math.round(conversionRate),
        monthly_goal: monthlyGoal,
        goal_progress: Math.min(100, Math.round((totalRevenue / monthlyGoal) * 100)),
        tasks_completed: tasksCompleted,
        tasks_pending: tasksPending,
        meetings_this_week: meetings?.length || 0,
      });
    } catch (error) {
      console.error("Error loading agent metrics:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
  };

  if (loading || !metrics) {
    return (
      <Layout title="Minha Performance">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Minha Performance">
      <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minha Performance 🎯</h1>
            <p className="text-gray-500 mt-2">Olá {agentName}, veja suas métricas e progresso</p>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Vendas do Mês
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.total_revenue)}</div>
              {metrics.deals_closed > 0 && (
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {metrics.deals_closed} negócio{metrics.deals_closed !== 1 ? "s" : ""} fechado{metrics.deals_closed !== 1 ? "s" : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Taxa de Conversão
              </CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversion_rate}%</div>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.active_leads} leads ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Tarefas
              </CardTitle>
              <CheckSquare className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.tasks_completed}</div>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.tasks_pending} pendentes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Reuniões (Semana)
              </CardTitle>
              <Calendar className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.meetings_this_week}</div>
              <p className="text-xs text-gray-500 mt-1">
                Esta semana
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Performance Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Monthly Goal Progress */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Meta do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Faturação</span>
                  <span className="text-sm text-gray-500">
                    {formatCurrency(metrics.total_revenue)} / {formatCurrency(metrics.monthly_goal)}
                  </span>
                </div>
                <Progress value={metrics.goal_progress} className="h-4" />
                <p className="text-xs text-right mt-1 text-gray-400">
                  {metrics.goal_progress}% atingido
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {metrics.goal_progress >= 100 ? "🎉 Meta Atingida!" : 
                       metrics.goal_progress >= 75 ? "🔥 Quase lá!" :
                       metrics.goal_progress >= 50 ? "💪 Continue assim!" :
                       "📈 Foco na meta!"}
                    </h4>
                    <p className="text-sm text-gray-700">
                      {metrics.goal_progress >= 100 ? "Parabéns! Você superou sua meta mensal!" :
                       metrics.goal_progress >= 75 ? "Faltam apenas " + formatCurrency(metrics.monthly_goal - metrics.total_revenue) + " para atingir sua meta!" :
                       metrics.goal_progress >= 50 ? "Você já está na metade do caminho. Continue focado!" :
                       "Ainda há " + formatCurrency(metrics.monthly_goal - metrics.total_revenue) + " para alcançar. Você consegue!"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Para atingir a meta:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Focar em leads de alta prioridade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Fazer follow-ups regulares</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Agendar mais reuniões presenciais</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-500" />
                Resumo de Atividade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Negócios Fechados</span>
                    <Trophy className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-900">{metrics.deals_closed}</div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Leads Ativos</span>
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{metrics.active_leads}</div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Tarefas Concluídas</span>
                    <CheckSquare className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-900">{metrics.tasks_completed}</div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Reuniões</span>
                    <Calendar className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-900">{metrics.meetings_this_week}</div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">💡 Dica de Produtividade</h4>
                <p className="text-sm text-yellow-800">
                  {metrics.tasks_pending > 10 
                    ? "Você tem muitas tarefas pendentes. Priorize as mais importantes e delegue quando possível."
                    : metrics.meetings_this_week < 5
                    ? "Agende mais reuniões com seus leads ativos para acelerar o processo de conversão."
                    : metrics.conversion_rate < 10
                    ? "Sua taxa de conversão pode melhorar. Foque em qualificar melhor os leads antes de investir tempo."
                    : "Excelente trabalho! Continue mantendo esse ritmo e organização."}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">Próximas Ações Sugeridas:</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>Revisar leads sem interação nos últimos 7 dias</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>Agendar follow-ups para leads em negociação</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>Atualizar status das propostas enviadas</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push("/leads")}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
              >
                <Users className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Ver Minhas Leads</span>
              </button>

              <button
                onClick={() => router.push("/tasks")}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-center"
              >
                <CheckSquare className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Minhas Tarefas</span>
              </button>

              <button
                onClick={() => router.push("/calendar")}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-center"
              >
                <Calendar className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Agenda</span>
              </button>

              <button
                onClick={() => router.push("/pipeline")}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-center"
              >
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Pipeline</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}