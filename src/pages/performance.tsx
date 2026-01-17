import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, Phone, Mail, Calendar, Target, Award, CheckCircle2, Home, Tag } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
type Deal = {
  id: string;
  user_id: string;
  deal_type: "seller" | "buyer" | "both";
  transaction_date: string;
  amount: number;
  notes?: string;
  created_at: string;
};

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalLeads: number;
  acquisitions: number;
  buyerLeads: number;
  sellerLeads: number;
  activeLeads: number;
  wonLeads: number;
  conversionRate: number;
  buyerConversionRate: number;
  sellerConversionRate: number;
  totalInteractions: number;
  callInteractions: number;
  emailInteractions: number;
  meetingInteractions: number;
  averageResponseTime: string;
}

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [leadTypeFilter, setLeadTypeFilter] = useState<"all" | "buyer" | "seller">("all");

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);
      setUserRole(profile.role || "agent");

      // Load agents based on role
      let agentsData: Profile[] = [];
      if (profile.role === "admin") {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .in("role", ["agent", "team_lead"]);
        agentsData = data || [];
      } else if (profile.role === "team_lead") {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "agent");
        agentsData = data || [];
      }
      setAgents(agentsData);

      // Load leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      setLeads(leadsData || []);

      // Load interactions
      const { data: interactionsData } = await supabase
        .from("interactions")
        .select("*")
        .order("interaction_date", { ascending: false });

      setInteractions(interactionsData || []);

      // Load deals
      const { data: dealsData } = await (supabase as any)
        .from("deals")
        .select("*")
        .order("transaction_date", { ascending: false });

      setDeals(dealsData || []);
    } catch (error) {
      console.error("Error loading performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (): AgentMetrics[] => {
    const metrics: AgentMetrics[] = [];
    const periodDays = parseInt(selectedPeriod);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Filter agents based on selection
    const agentsToAnalyze = selectedAgent === "all" 
      ? agents 
      : agents.filter(a => a.id === selectedAgent);

    agentsToAnalyze.forEach(agent => {
      // Filter leads by agent and period
      const agentLeads = leads.filter(lead => {
        const isAssigned = lead.assigned_to === agent.id;
        const isInPeriod = new Date(lead.created_at || "") >= startDate;
        
        // Apply lead type filter
        let matchesType = true;
        if (leadTypeFilter === "buyer") {
          matchesType = lead.lead_type === "buyer";
        } else if (leadTypeFilter === "seller") {
          matchesType = lead.lead_type === "seller";
        }
        
        return isAssigned && isInPeriod && matchesType;
      });

      // Filter deals (acquisitions) by agent and period
      const agentDeals = deals.filter(deal => {
        const isAgent = deal.user_id === agent.id;
        const isInPeriod = new Date(deal.transaction_date || "") >= startDate;
        
        // Apply lead type filter for acquisitions
        let matchesType = true;
        if (leadTypeFilter === "buyer") {
          matchesType = deal.deal_type === "buyer" || deal.deal_type === "both";
        } else if (leadTypeFilter === "seller") {
          matchesType = deal.deal_type === "seller" || deal.deal_type === "both";
        }
        
        return isAgent && isInPeriod && matchesType;
      });

      const acquisitions = agentDeals.length;

      // Calculate buyer/seller specific metrics
      const buyerLeads = agentLeads.filter(l => l.lead_type === "buyer");
      const sellerLeads = agentLeads.filter(l => l.lead_type === "seller");
      
      const activeLeads = agentLeads.filter(l => !["won", "lost"].includes(l.status || ""));
      const wonLeads = agentLeads.filter(l => l.status === "won");
      const buyerWonLeads = buyerLeads.filter(l => l.status === "won");
      const sellerWonLeads = sellerLeads.filter(l => l.status === "won");

      // Filter interactions by agent and period
      const agentInteractions = interactions.filter(interaction => {
        const isAgent = interaction.user_id === agent.id;
        const isInPeriod = new Date(interaction.interaction_date || "") >= startDate;
        
        // Filter interactions by related lead type
        if (leadTypeFilter !== "all" && interaction.lead_id) {
          const relatedLead = leads.find(l => l.id === interaction.lead_id);
          if (relatedLead) {
            return isAgent && isInPeriod && relatedLead.lead_type === leadTypeFilter;
          }
        }
        
        return isAgent && isInPeriod;
      });

      const callInteractions = agentInteractions.filter(i => i.interaction_type === "call");
      const emailInteractions = agentInteractions.filter(i => i.interaction_type === "email");
      const meetingInteractions = agentInteractions.filter(i => i.interaction_type === "meeting");

      const conversionRate = agentLeads.length > 0 ? (wonLeads.length / agentLeads.length) * 100 : 0;
      const buyerConversionRate = buyerLeads.length > 0 ? (buyerWonLeads.length / buyerLeads.length) * 100 : 0;
      const sellerConversionRate = sellerLeads.length > 0 ? (sellerWonLeads.length / sellerLeads.length) * 100 : 0;

      metrics.push({
        agentId: agent.id,
        agentName: agent.full_name || agent.email || "Sem nome",
        totalLeads: agentLeads.length,
        acquisitions,
        buyerLeads: buyerLeads.length,
        sellerLeads: sellerLeads.length,
        activeLeads: activeLeads.length,
        wonLeads: wonLeads.length,
        conversionRate,
        buyerConversionRate,
        sellerConversionRate,
        totalInteractions: agentInteractions.length,
        callInteractions: callInteractions.length,
        emailInteractions: emailInteractions.length,
        meetingInteractions: meetingInteractions.length,
        averageResponseTime: "2.5h", // Placeholder
      });
    });

    return metrics.sort((a, b) => b.conversionRate - a.conversionRate);
  };

  const metrics = calculateMetrics();

  // Calculate team totals
  const teamTotals = metrics.reduce(
    (acc, curr) => ({
      totalLeads: acc.totalLeads + curr.totalLeads,
      acquisitions: acc.acquisitions + curr.acquisitions,
      buyerLeads: acc.buyerLeads + curr.buyerLeads,
      sellerLeads: acc.sellerLeads + curr.sellerLeads,
      wonLeads: acc.wonLeads + curr.wonLeads,
      totalInteractions: acc.totalInteractions + curr.totalInteractions,
    }),
    { totalLeads: 0, acquisitions: 0, buyerLeads: 0, sellerLeads: 0, wonLeads: 0, totalInteractions: 0 }
  );

  const teamConversionRate = teamTotals.totalLeads > 0 
    ? (teamTotals.wonLeads / teamTotals.totalLeads) * 100 
    : 0;

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin", "team_lead"]}>
        <Layout>
          <div className="container mx-auto p-6">
            <p>A carregar...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "team_lead"]}>
      <Layout>
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Performance da Equipa</h1>
            <p className="text-muted-foreground">
              Métricas e estatísticas de desempenho da sua equipa
            </p>
          </div>

          {/* Lead Type Filter - Prominent Position */}
          <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Filtrar Tipo de Lead</h3>
                  <p className="text-sm text-muted-foreground">
                    Ver métricas por compradores, vendedores ou ambos
                  </p>
                </div>
              </div>
              <Tabs 
                value={leadTypeFilter} 
                onValueChange={(value) => setLeadTypeFilter(value as "all" | "buyer" | "seller")}
                className="w-auto"
              >
                <TabsList className="grid grid-cols-3 w-[400px]">
                  <TabsTrigger value="all" className="gap-2">
                    <Users className="h-4 w-4" />
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="buyer" className="gap-2">
                    <Home className="h-4 w-4" />
                    Compradores
                  </TabsTrigger>
                  <TabsTrigger value="seller" className="gap-2">
                    <Tag className="h-4 w-4" />
                    Vendedores
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Card>

          {/* Team Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Angariações</p>
                  <p className="text-3xl font-bold mt-2">{teamTotals.acquisitions}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Negócios captados no período
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-50">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {leadTypeFilter === "buyer" ? "Compradores" : leadTypeFilter === "seller" ? "Vendedores" : "Leads Ativos"}
                  </p>
                  <p className="text-3xl font-bold mt-2">
                    {leadTypeFilter === "buyer" ? teamTotals.buyerLeads : leadTypeFilter === "seller" ? teamTotals.sellerLeads : teamTotals.totalLeads}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-50">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversões</p>
                  <p className="text-3xl font-bold mt-2">{teamTotals.wonLeads}</p>
                </div>
                <div className="p-3 rounded-full bg-purple-50">
                  <CheckCircle2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-3xl font-bold mt-2">{teamConversionRate.toFixed(1)}%</p>
                </div>
                <div className="p-3 rounded-full bg-orange-50">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Interações</p>
                  <p className="text-3xl font-bold mt-2">{teamTotals.totalInteractions}</p>
                </div>
                <div className="p-3 rounded-full bg-pink-50">
                  <Phone className="h-6 w-6 text-pink-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Agent Performance Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Desempenho por Agente</h2>
            <div className="grid gap-4">
              {metrics.map((metric) => (
                <Card key={metric.agentId} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {metric.agentName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{metric.agentName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {metric.acquisitions} angariações • {metric.wonLeads} conversões
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-600" />
                      <span className="text-2xl font-bold text-yellow-600">
                        {metric.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Buyer vs Seller Stats */}
                  {leadTypeFilter === "all" && (
                    <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">🏠 Compradores</p>
                        <div className="space-y-1">
                          <p className="text-sm">
                            <span className="font-semibold">{metric.buyerLeads}</span> leads
                          </p>
                          <p className="text-sm">
                            Taxa: <span className="font-semibold text-green-600">{metric.buyerConversionRate.toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">🏷️ Vendedores</p>
                        <div className="space-y-1">
                          <p className="text-sm">
                            <span className="font-semibold">{metric.sellerLeads}</span> leads
                          </p>
                          <p className="text-sm">
                            Taxa: <span className="font-semibold text-blue-600">{metric.sellerConversionRate.toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interaction Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <Phone className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-blue-600">{metric.callInteractions}</p>
                      <p className="text-xs text-muted-foreground">Chamadas</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <Mail className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-green-600">{metric.emailInteractions}</p>
                      <p className="text-xs text-muted-foreground">Emails</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-purple-600">{metric.meetingInteractions}</p>
                      <p className="text-xs text-muted-foreground">Reuniões</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-orange-600">{metric.activeLeads}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}