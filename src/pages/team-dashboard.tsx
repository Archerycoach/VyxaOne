import { useEffect, useState } from "react";
import { 
  Users, 
  Target, 
  Trophy, 
  TrendingUp, 
  DollarSign, 
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";

interface AgentMetrics {
  id: string;
  name: string;
  avatar?: string;
  deals_closed: number;
  total_revenue: number;
  active_leads: number;
  conversion_rate: number;
  monthly_goal: number;
  goal_progress: number;
  acquisitions: number;
  avg_response_minutes: number | null;
}

type RankBy = "revenue" | "deals_closed" | "conversion_rate" | "response_time";

const RANK_COMPARATORS: Record<RankBy, (a: AgentMetrics, b: AgentMetrics) => number> = {
  revenue: (a, b) => b.total_revenue - a.total_revenue,
  deals_closed: (a, b) => b.deals_closed - a.deals_closed,
  conversion_rate: (a, b) => b.conversion_rate - a.conversion_rate,
  // Tempo de resposta: quanto menor, melhor; quem ainda não tem nenhuma lead
  // contactada fica no fim (não é possível avaliar).
  response_time: (a, b) => {
    if (a.avg_response_minutes === null) return 1;
    if (b.avg_response_minutes === null) return -1;
    return a.avg_response_minutes - b.avg_response_minutes;
  },
};

interface Deal {
  id: string;
  user_id: string;
  deal_type: "seller" | "buyer" | "both";
  transaction_date: string;
  amount: number;
}

// Média de minutos entre a criação da lead e o primeiro contacto registado,
// para as leads do agente que já foram contactadas. null se nenhuma foi.
const calculateAvgResponseMinutes = (
  leads: { created_at: string | null; first_contact_at: string | null }[]
): number | null => {
  const contacted = leads.filter((l) => l.created_at && l.first_contact_at);
  if (contacted.length === 0) return null;

  const totalMinutes = contacted.reduce((sum, l) => {
    const minutes = (new Date(l.first_contact_at!).getTime() - new Date(l.created_at!).getTime()) / (1000 * 60);
    return sum + Math.max(0, minutes);
  }, 0);

  return Math.round(totalMinutes / contacted.length);
};

export default function TeamDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedView, setSelectedView] = useState<string>("team");
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>("all");
  const [rankBy, setRankBy] = useState<RankBy>("revenue");
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && (profile.role === "admin" || profile.role === "broker" || profile.role === "team_lead")) {
        setUserRole(profile.role);
        setHasAccess(true);
        loadAgents(profile.role);
        loadTeamMetrics(profile.role);
      } else {
        router.push("/performance");
      }
    } catch (error) {
      console.error("Error checking access:", error);
      router.push("/dashboard");
    }
  };

  useEffect(() => {
    if (hasAccess) {
      if (selectedView === "team") {
        loadTeamMetrics();
      } else {
        loadAgentMetrics(selectedView);
      }
    }
  }, [selectedView, leadTypeFilter, hasAccess]);

  const loadAgents = async (roleOverride?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const role = roleOverride ?? userRole;

      let agentsQuery = supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true);

      if (role === "admin" || role === "broker") {
        // Admins/brokers veem todos os team leads e consultores
        agentsQuery = agentsQuery.in("role", ["consultant", "team_lead"]);
      } else {
        // Team leads veem só os seus consultores diretos
        agentsQuery = agentsQuery.eq("team_lead_id", user.id).eq("role", "consultant");
      }

      const { data } = await agentsQuery;

      if (data) {
        setAgents(data.map(a => ({ id: a.id, name: a.full_name || "Agente" })));
      }
    } catch (error) {
      console.error("Error loading agents:", error);
    }
  };

  const loadTeamMetrics = async (roleOverride?: string) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const role = roleOverride ?? userRole;

      let agentsQueryBuilder = supabase
        .from("profiles")
        .select("*");

      if (role === "admin" || role === "broker") {
        // Admins/brokers veem todos os team leads e consultores
        agentsQueryBuilder = agentsQueryBuilder.in("role", ["consultant", "team_lead"]);
      } else {
        // Team leads veem só os seus consultores diretos
        agentsQueryBuilder = agentsQueryBuilder.eq("team_lead_id", user.id).eq("role", "consultant");
      }

      const { data: agentsData } = await agentsQueryBuilder;

      if (!agentsData || agentsData.length === 0) {
        setMetrics([]);
        return;
      }

      // Fetch all deals
      const { data: dealsData } = await (supabase as any)
        .from("deals")
        .select("*")
        .order("transaction_date", { ascending: false });

      setDeals(dealsData || []);

      const metricsPromises = agentsData.map(async (agent) => {
        let query = supabase
          .from("leads")
          .select("status, lead_type, created_at, first_contact_at")
          .eq("assigned_to", agent.id);

        if (leadTypeFilter === "buyers") {
          query = query.in("lead_type", ["buyer", "both"]);
        } else if (leadTypeFilter === "sellers") {
          query = query.in("lead_type", ["seller", "both"]);
        }

        const { data: leads } = await query;

        // Calculate acquisitions from deals
        const agentDeals = (dealsData || []).filter((d: Deal) => d.user_id === agent.id);
        let acquisitions = 0;

        if (leadTypeFilter === "all" || leadTypeFilter === "sellers") {
          acquisitions = agentDeals.filter((d: Deal) =>
            d.deal_type === "seller" || d.deal_type === "both"
          ).length;
        }

        // Negócios/faturação vêm da tabela "deals" (valores reais), não do
        // status da lead — o pipeline desta app nunca marca leads como
        // "won"; o fecho de negócio é registado à parte, em "Negócios".
        const relevantDeals = agentDeals.filter((d: Deal) => {
          if (leadTypeFilter === "buyers") return d.deal_type === "buyer" || d.deal_type === "both";
          if (leadTypeFilter === "sellers") return d.deal_type === "seller" || d.deal_type === "both";
          return true;
        });
        const dealsClosed = relevantDeals.length;
        const totalRevenue = relevantDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);

        const totalLeads = leads?.length || 0;
        const activeLeads = leads?.filter(l => !["won", "lost"].includes(l.status)).length || 0;
        const conversionRate = totalLeads > 0 ? (dealsClosed / totalLeads) * 100 : 0;
        const avgResponseMinutes = calculateAvgResponseMinutes(leads || []);

        return {
          id: agent.id,
          name: agent.full_name || agent.email || "Agente",
          avatar: (agent.full_name || agent.email || "A").split(" ").map((n: string) => n[0]).join("").toUpperCase(),
          deals_closed: dealsClosed,
          total_revenue: totalRevenue,
          active_leads: activeLeads,
          conversion_rate: Math.round(conversionRate),
          monthly_goal: 500000,
          goal_progress: Math.min(100, Math.round((totalRevenue / 500000) * 100)),
          acquisitions,
          avg_response_minutes: avgResponseMinutes,
        };
      });

      const calculatedMetrics = await Promise.all(metricsPromises);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error("Error loading metrics:", error);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentMetrics = async (agentId: string) => {
    try {
      setLoading(true);
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      let query = supabase
        .from("leads")
        .select("status, lead_type, created_at, first_contact_at")
        .eq("assigned_to", agentId);

      if (leadTypeFilter === "buyers") {
        query = query.in("lead_type", ["buyer", "both"]);
      } else if (leadTypeFilter === "sellers") {
        query = query.in("lead_type", ["seller", "both"]);
      }

      const { data: leads } = await query;

      // Fetch deals for this agent
      const { data: dealsData } = await (supabase as any)
        .from("deals")
        .select("*")
        .eq("user_id", agentId)
        .order("transaction_date", { ascending: false });

      // Calculate acquisitions
      let acquisitions = 0;
      if (leadTypeFilter === "all" || leadTypeFilter === "sellers") {
        acquisitions = (dealsData || []).filter((d: Deal) => 
          d.deal_type === "seller" || d.deal_type === "both"
        ).length;
      }

      const relevantDeals = (dealsData || []).filter((d: Deal) => {
        if (leadTypeFilter === "buyers") return d.deal_type === "buyer" || d.deal_type === "both";
        if (leadTypeFilter === "sellers") return d.deal_type === "seller" || d.deal_type === "both";
        return true;
      });
      const dealsClosed = relevantDeals.length;
      const totalRevenue = relevantDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);

      const totalLeads = leads?.length || 0;
      const activeLeads = leads?.filter(l => !["won", "lost"].includes(l.status)).length || 0;
      const conversionRate = totalLeads > 0 ? (dealsClosed / totalLeads) * 100 : 0;

      const agentMetric: AgentMetrics = {
        id: agentId,
        name: agent.name,
        avatar: agent.name.split(" ").map(n => n[0]).join("").toUpperCase(),
        deals_closed: dealsClosed,
        total_revenue: totalRevenue,
        active_leads: activeLeads,
        conversion_rate: Math.round(conversionRate),
        monthly_goal: 200000,
        goal_progress: Math.min(100, Math.round((totalRevenue / 200000) * 100)),
        acquisitions,
        avg_response_minutes: calculateAvgResponseMinutes(leads || []),
      };

      setMetrics([agentMetric]);
    } catch (error) {
      console.error("Error loading agent metrics:", error);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
  };

  const totalRevenue = metrics.reduce((sum, m) => sum + m.total_revenue, 0);
  const totalDeals = metrics.reduce((sum, m) => sum + m.deals_closed, 0);
  const totalLeads = metrics.reduce((sum, m) => sum + m.active_leads, 0);
  const totalAcquisitions = metrics.reduce((sum, m) => sum + m.acquisitions, 0);
  const avgConversion = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.conversion_rate, 0) / metrics.length
    : 0;

  const rankedMetrics = [...metrics].sort(RANK_COMPARATORS[rankBy]);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Layout title="Performance da Equipa">
      <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance 🏆</h1>
            <p className="text-gray-500 mt-2">Métricas, metas e rankings</p>
          </div>
          <div className="flex gap-3">
            <Select value={leadTypeFilter} onValueChange={setLeadTypeFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tipo de Lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📊 Todos os Leads</SelectItem>
                <SelectItem value="buyers">🏠 Compradores</SelectItem>
                <SelectItem value="sellers">💼 Vendedores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedView} onValueChange={setSelectedView}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione a visualização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">📊 Equipa Completa</SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    👤 {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Vendas (Mês)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              {totalRevenue > 0 && (
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {totalDeals} negócio{totalDeals !== 1 ? "s" : ""} fechado{totalDeals !== 1 ? "s" : ""}
                </p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Negócios Fechados
              </CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDeals}</div>
              <p className="text-xs text-gray-500 mt-1">
                {totalLeads} leads ativos
              </p>
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
              <div className="text-2xl font-bold">{avgConversion.toFixed(1)}%</div>
              <p className="text-xs text-green-600 mt-1">
                Média {selectedView === "team" ? "da equipa" : "do agente"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Leads Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <p className="text-xs text-gray-500 mt-1">
                Em acompanhamento
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                {selectedView === "team" ? "Ranking de Performance" : "Desempenho Individual"}
              </CardTitle>
              {selectedView === "team" && (
                <Select value={rankBy} onValueChange={(value) => setRankBy(value as RankBy)}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">💶 Faturação</SelectItem>
                    <SelectItem value="deals_closed">🏆 Negócios Fechados</SelectItem>
                    <SelectItem value="conversion_rate">🎯 Taxa de Conversão</SelectItem>
                    <SelectItem value="response_time">⚡ Tempo de Resposta</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : rankedMetrics.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum agente encontrado ou sem dados de performance.
                </div>
              ) : (
                rankedMetrics.map((agent, index) => (
                  <div key={agent.id} className="flex items-center gap-4">
                    {selectedView === "team" && (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-slate-600 text-sm">
                        {medals[index] || index + 1}
                      </div>
                    )}
                    <Avatar>
                      <AvatarFallback>{agent.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(agent.total_revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>{agent.deals_closed} negócios</span>
                        <span>{agent.conversion_rate}% conv.</span>
                        <span>
                          {agent.avg_response_minutes !== null
                            ? `⚡ ${agent.avg_response_minutes} min resp.`
                            : "⚡ sem dados"}
                        </span>
                      </div>
                      <Progress value={agent.goal_progress} className="h-2" />
                      <p className="text-xs text-right mt-1 text-gray-400">
                        {agent.goal_progress}% da meta
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-red-500" />
                Metas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Faturação Global</span>
                    <span className="text-sm text-gray-500">
                      {totalRevenue > 0 ? Math.round((totalRevenue / (metrics.length * 500000)) * 100) : 0}% atingido
                    </span>
                  </div>
                  <Progress value={totalRevenue > 0 ? Math.min(100, (totalRevenue / (metrics.length * 500000)) * 100) : 0} className="h-3 bg-slate-100" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Angariações</span>
                    <span className="text-sm text-gray-500">{totalAcquisitions > 0 ? Math.round((totalAcquisitions / 20) * 100) : 0}% atingido</span>
                  </div>
                  <Progress value={totalAcquisitions > 0 ? Math.min(100, (totalAcquisitions / 20) * 100) : 0} className="h-3 bg-slate-100" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Taxa de Conversão</span>
                    <span className="text-sm text-gray-500">{avgConversion > 0 ? Math.round((avgConversion / 15) * 100) : 0}% atingido</span>
                  </div>
                  <Progress value={avgConversion > 0 ? Math.min(100, (avgConversion / 15) * 100) : 0} className="h-3 bg-slate-100" />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg mt-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Dica de Performance 💡</h4>
                  <p className="text-sm text-blue-700">
                    {selectedView === "team" 
                      ? metrics.length > 0 
                        ? "Focar em leads qualificados e fazer follow-ups regulares pode melhorar a taxa de conversão da equipa."
                        : "Configure agentes e comece a adicionar leads para ver métricas de performance."
                      : "Focar em leads qualificados e fazer follow-ups regulares pode melhorar a taxa de conversão."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}