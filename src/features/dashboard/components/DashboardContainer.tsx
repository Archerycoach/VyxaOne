import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Clock,
  Award,
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Calendar
} from "lucide-react";
import { useDashboardAuth, useDashboardFilters, useDashboardData } from "../hooks";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend?: "up" | "down";
  trendValue?: number;
  className?: string;
}

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  className = "" 
}: StatCardProps) => (
  <Card className={`border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow ${className}`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trendValue !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === "up" ? "text-green-600" : "text-red-600"
            }`}>
              {trend === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-medium">{Math.abs(trendValue).toFixed(1)}%</span>
              <span className="text-gray-500">vs mês anterior</span>
            </div>
          )}
        </div>
        <div className={`p-4 rounded-full ${
          trend === "up" ? "bg-green-100" : trend === "down" ? "bg-red-100" : "bg-blue-100"
        }`}>
          <Icon className={`h-8 w-8 ${
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-blue-600"
          }`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export function DashboardContainer() {
  const { userRole, currentUserId, agents, isLoading: authLoading } = useDashboardAuth();
  const { period, setPeriod, selectedAgent, setSelectedAgent } = useDashboardFilters();
  const { stats, chartData, loading } = useDashboardData({
    period,
    selectedAgent,
    userRole,
    currentUserId,
    agents,
  });

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  const showFilters = userRole === "admin" || userRole === "team_lead";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Visão geral do seu negócio imobiliário</p>
          </div>

          {/* Filters for Admin/Team Lead */}
          {showFilters && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtros:</span>
              </div>

              {/* Period Filter */}
              <Select value={period.toString()} onValueChange={(value) => setPeriod(Number(value) as 3 | 6 | 12)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Meses</SelectItem>
                  <SelectItem value="6">6 Meses</SelectItem>
                  <SelectItem value="12">12 Meses</SelectItem>
                </SelectContent>
              </Select>

              {/* Agent Filter */}
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {userRole === "admin" ? "Todos os Agentes" : "Toda a Equipa"}
                  </SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total de Leads"
            value={stats.totalLeads}
            icon={Users}
            trend={stats.leadsGrowth >= 0 ? "up" : "down"}
            trendValue={stats.leadsGrowth}
          />
          <StatCard
            title="Leads Ativos"
            value={stats.activeLeads}
            icon={Target}
            className="border-blue-200"
          />
          <StatCard
            title="Taxa de Conversão"
            value={`${stats.conversionRate.toFixed(1)}%`}
            icon={Award}
            className="border-green-200"
          />
          <StatCard
            title="Valor Médio"
            value={`€${(stats.averageBudget / 1000).toFixed(0)}k`}
            icon={DollarSign}
            className="border-purple-200"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border-2 border-gray-200">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="pipeline">Funil</TabsTrigger>
            <TabsTrigger value="properties">Imóveis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Imóveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="text-2xl font-bold">{stats.totalProperties}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Disponíveis</span>
                      <span className="text-lg font-semibold text-green-600">{stats.availableProperties}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Tarefas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="text-2xl font-bold">{stats.totalTasks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Concluídas</span>
                      <span className="text-lg font-semibold text-blue-600">{stats.completedTasks}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Agenda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Hoje</span>
                      <span className="text-2xl font-bold">{stats.todayEvents}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>Eventos agendados</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>
                  Evolução de Leads (Últimos {period} Meses)
                  {selectedAgent !== "all" && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      - {agents.find(a => a.id === selectedAgent)?.full_name || "Agente"}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <div className="flex items-end justify-between gap-4 h-64 pb-8 px-4">
                    {chartData.map((data, index) => {
                      const maxLeads = Math.max(...chartData.map(d => d.leads), 1);
                      
                      const totalHeight = data.leads === 0 
                        ? 0 
                        : Math.max((data.leads / maxLeads) * 100, 15);
                      
                      const wonHeight = data.won === 0 
                        ? 0 
                        : Math.max((data.won / maxLeads) * 100, 8);
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="w-full flex items-end justify-center gap-2 h-52">
                            {/* Blue Bar - Total Leads */}
                            <div className="relative flex-1 flex flex-col justify-end max-w-[40px]">
                              {data.leads > 0 ? (
                                <div 
                                  className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 cursor-pointer relative"
                                  style={{ height: `${totalHeight}%` }}
                                  title={`${data.leads} leads totais`}
                                >
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {data.leads}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-2 bg-gray-100 rounded opacity-30" />
                              )}
                            </div>
                            
                            {/* Green Bar - Won Leads */}
                            <div className="relative flex-1 flex flex-col justify-end max-w-[40px]">
                              {data.won > 0 ? (
                                <div 
                                  className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600 cursor-pointer relative"
                                  style={{ height: `${wonHeight}%` }}
                                  title={`${data.won} leads ganhos`}
                                >
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {data.won}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-2 bg-gray-100 rounded opacity-30" />
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-600 font-medium uppercase">{data.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm text-gray-600 font-medium">Total Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm text-gray-600 font-medium">Leads Ganhos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-900">Leads Ganhos</p>
                      <p className="text-3xl font-bold text-green-700 mt-2">{stats.wonLeads}</p>
                    </div>
                    <Award className="h-10 w-10 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-900">Leads Perdidos</p>
                      <p className="text-3xl font-bold text-red-700 mt-2">{stats.lostLeads}</p>
                    </div>
                    <TrendingDown className="h-10 w-10 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Este Mês</p>
                      <p className="text-3xl font-bold text-blue-700 mt-2">{stats.leadsThisMonth}</p>
                    </div>
                    <Calendar className="h-10 w-10 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-900">Mês Anterior</p>
                      <p className="text-3xl font-bold text-purple-700 mt-2">{stats.leadsLastMonth}</p>
                    </div>
                    <Clock className="h-10 w-10 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>Performance do Funil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <span className="font-medium">Taxa de Conversão Geral</span>
                    <span className="text-2xl font-bold text-green-600">{stats.conversionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <span className="font-medium">Valor Médio por Lead</span>
                    <span className="text-2xl font-bold text-blue-600">€{(stats.averageBudget / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <span className="font-medium">Leads em Negociação</span>
                    <span className="text-2xl font-bold text-purple-600">{stats.activeLeads}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="properties" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader>
                  <CardTitle>Estado dos Imóveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-900">Disponíveis</span>
                      <span className="text-xl font-bold text-green-700">{stats.availableProperties}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">Total</span>
                      <span className="text-xl font-bold text-gray-700">{stats.totalProperties}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader>
                  <CardTitle>Ocupação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                        style={{ 
                          width: `${stats.totalProperties > 0 ? (stats.availableProperties / stats.totalProperties) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 text-center">
                      {stats.totalProperties > 0 
                        ? ((stats.availableProperties / stats.totalProperties) * 100).toFixed(1)
                        : 0}% disponíveis
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}