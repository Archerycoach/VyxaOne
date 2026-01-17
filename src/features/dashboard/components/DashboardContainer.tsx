import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  TrendingUp, 
  Target,
  Home,
  Tag,
  ChevronDown,
  UserCircle,
  DollarSign,
  Calendar,
  CheckCircle2,
  Building2,
  Award,
  TrendingDown,
  Clock
} from "lucide-react";
import { useDashboardAuth } from "../hooks/useDashboardAuth";
import { useDashboardData } from "../hooks/useDashboardData";
import { useDashboardFilters } from "../hooks/useDashboardFilters";
import { useRouter } from "next/router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function DashboardContainer() {
  const router = useRouter();
  const { currentUserId, userRole, isLoading: authLoading } = useDashboardAuth();
  const { leadTypeFilter, setLeadTypeFilter, selectedAgent, setSelectedAgent } = useDashboardFilters();
  const { stats, upcomingEvents, todayTasks, loading: dataLoading, error } = useDashboardData({
    userRole,
    currentUserId,
    selectedAgentId: selectedAgent === "all" ? null : selectedAgent,
    leadTypeFilter,
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const isAdminOrTeamLead = userRole === "admin" || userRole === "team_lead";

  // Load team members if admin or team lead
  useEffect(() => {
    if (!isAdminOrTeamLead) return;

    const loadTeamMembers = async () => {
      setLoadingTeam(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("role", ["agent", "team_lead", "admin"])
          .order("full_name");

        if (error) throw error;
        setTeamMembers(data || []);
      } catch (err) {
        console.error("Error loading team members:", err);
      } finally {
        setLoadingTeam(false);
      }
    };

    loadTeamMembers();
  }, [isAdminOrTeamLead]);

  const getLeadTypeLabel = () => {
    if (leadTypeFilter === "buyer") return "Compradores";
    if (leadTypeFilter === "seller") return "Vendedores";
    return "Todos os leads";
  };

  const selectedMember = teamMembers.find(m => m.id === selectedAgent);
  const agentName = selectedAgent === "all" ? "Equipa Toda" : selectedMember?.full_name || "Agente";

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6 max-w-md">
          <p className="text-red-600 mb-2">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral do seu negócio imobiliário
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex gap-3">
            {/* Agent Selector - Only for Admin/Team Lead */}
            {isAdminOrTeamLead && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      <span className="max-w-[120px] truncate">{agentName}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem
                    onClick={() => setSelectedAgent("all")}
                    className="cursor-pointer"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Equipa Toda
                  </DropdownMenuItem>
                  {teamMembers.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setSelectedAgent(member.id)}
                      className="cursor-pointer"
                    >
                      <UserCircle className="h-4 w-4 mr-2" />
                      <span className="truncate">{member.full_name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Lead Type Filter Buttons */}
            <div className="flex gap-2">
              <Button
                variant={leadTypeFilter === "all" ? "default" : "outline"}
                onClick={() => setLeadTypeFilter("all")}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={leadTypeFilter === "buyer" ? "default" : "outline"}
                onClick={() => setLeadTypeFilter("buyer")}
                size="sm"
              >
                <Home className="h-4 w-4 mr-1" />
                Compradores
              </Button>
              <Button
                variant={leadTypeFilter === "seller" ? "default" : "outline"}
                onClick={() => setLeadTypeFilter("seller")}
                size="sm"
              >
                <Tag className="h-4 w-4 mr-1" />
                Vendedores
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total de Leads */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Total de Leads
              </p>
              <p className="text-4xl font-bold mb-2">{stats?.totalLeads || 0}</p>
              <p className="text-xs text-muted-foreground">
                {getLeadTypeLabel()}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        {/* Leads Ativos */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Leads Ativos
              </p>
              <p className="text-4xl font-bold mb-2">{stats?.totalLeads || 0}</p>
              <p className="text-xs text-muted-foreground">
                Em processo
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Taxa de Conversão */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Taxa de Conversão
              </p>
              <p className="text-4xl font-bold mb-2">
                {stats?.conversionRate ? stats.conversionRate.toFixed(1) : "0.0"}%
              </p>
              <p className="text-xs text-muted-foreground">
                {leadTypeFilter === "buyer" ? "Compradores convertidos" : 
                 leadTypeFilter === "seller" ? "Vendedores convertidos" : "Conversão geral"}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Valor Médio */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Valor Médio
              </p>
              <p className="text-4xl font-bold mb-2">€236k</p>
              <p className="text-xs text-muted-foreground">
                Por transação
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="imoveis">Imóveis</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-4">
          {/* Three Column Layout */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Imóveis */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Imóveis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Disponíveis</span>
                  <span className="text-2xl font-bold text-green-600">0</span>
                </div>
              </div>
            </Card>

            {/* Tarefas */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Tarefas</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold">{todayTasks?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Concluídas</span>
                  <span className="text-2xl font-bold text-blue-600">0</span>
                </div>
              </div>
            </Card>

            {/* Agenda */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agenda</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hoje</span>
                  <span className="text-2xl font-bold">{upcomingEvents?.length || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Eventos agendados</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Goal Progress Cards */}
          {(stats?.annualRevenueGoal > 0 || stats?.annualAcquisitionsGoal > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Annual Revenue Progress */}
              {stats?.annualRevenueGoal > 0 && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Faturação Anual</h3>
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Realizado</p>
                        <p className="text-2xl font-bold">€{(stats?.totalRevenue || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Meta</p>
                        <p className="text-xl font-semibold text-blue-600">€{stats.annualRevenueGoal.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(stats?.annualRevenueProgress || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-center font-medium">
                      {(stats?.annualRevenueProgress || 0).toFixed(1)}% concluído
                    </p>
                  </div>
                </Card>
              )}

              {/* Annual Acquisitions Progress */}
              {stats?.annualAcquisitionsGoal > 0 && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Angariações Anuais</h3>
                    <Building2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Realizadas</p>
                        <p className="text-2xl font-bold">{stats?.wonLeads || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Meta</p>
                        <p className="text-xl font-semibold text-green-600">{stats.annualAcquisitionsGoal}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(stats?.annualAcquisitionsProgress || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-center font-medium">
                      {(stats?.annualAcquisitionsProgress || 0).toFixed(1)}% concluído
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Chart Section */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Evolução de Leads (Últimos 6 Meses)</h3>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>Gráfico em desenvolvimento</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          {/* 4 Cards Grid - Leads Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Leads Ganhos */}
            <Card className="p-6 bg-green-50 border-green-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 mb-1">
                    Leads Ganhos
                  </p>
                  <p className="text-5xl font-bold text-green-700 mb-2">0</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <Award className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </Card>

            {/* Leads Perdidos */}
            <Card className="p-6 bg-red-50 border-red-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 mb-1">
                    Leads Perdidos
                  </p>
                  <p className="text-5xl font-bold text-red-700 mb-2">0</p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </Card>

            {/* Este Mês */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 mb-1">
                    Este Mês
                  </p>
                  <p className="text-5xl font-bold text-blue-700 mb-2">{stats?.totalLeads || 0}</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </Card>

            {/* Mês Anterior */}
            <Card className="p-6 bg-purple-50 border-purple-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700 mb-1">
                    Mês Anterior
                  </p>
                  <p className="text-5xl font-bold text-purple-700 mb-2">0</p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funil">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Performance do Funil</h3>
            <div className="space-y-4">
              {/* Taxa de Conversão Geral */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-base font-medium">Taxa de Conversão Geral</span>
                <span className="text-3xl font-bold text-green-600">
                  {stats?.conversionRate ? stats.conversionRate.toFixed(1) : "0.0"}%
                </span>
              </div>

              {/* Valor Médio por Lead */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <span className="text-base font-medium">Valor Médio por Lead</span>
                <span className="text-3xl font-bold text-blue-600">€236k</span>
              </div>

              {/* Leads em Negociação */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <span className="text-base font-medium">Leads em Negociação</span>
                <span className="text-3xl font-bold text-purple-600">{stats?.totalLeads || 0}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="imoveis">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total de Imóveis */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total de Imóveis
                  </p>
                  <p className="text-5xl font-bold mb-2">1</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>

            {/* Vendidos */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Vendidos
                  </p>
                  <p className="text-5xl font-bold mb-2">0</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>

            {/* Arrendados */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Arrendados
                  </p>
                  <p className="text-5xl font-bold mb-2">0</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Home className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}