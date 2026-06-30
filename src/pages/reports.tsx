import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, FunnelChart, Funnel, LabelList } from "recharts";
import { Download, Calendar, Filter, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, Property } from "@/types";
import { ScopeSelector } from "@/components/ScopeSelector";

export default function ReportsPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  // Filters
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  
  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    activeProperties: 0,
    wonDeals: 0,
    conversionRate: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authorized) {
      loadMetrics();
    }
  }, [dateRange, authorized, scopeFilter]);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.log("No valid session found, redirecting to login");
        router.push("/login");
        return;
      }

      // Get user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, id")
        .eq("id", session.user.id)
        .single();

      setCurrentUserRole(profile?.role || null);
      
      // Consultant always sees only their own data
      if (profile?.role === "consultant") {
        setScopeFilter(profile.id);
      }

      setAuthorized(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      if (error?.message?.includes("Auth session missing")) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      const startDateStr = startDate.toISOString();

      // Build query with scope filter
      let leadsQuery = supabase
        .from("leads")
        .select("*")
        .gte("created_at", startDateStr);

      let propertiesQuery = supabase
        .from("properties")
        .select("*")
        .gte("created_at", startDateStr);

      // Apply scope filter if not "all"
      if (scopeFilter !== "all") {
        leadsQuery = leadsQuery.eq("user_id", scopeFilter);
        propertiesQuery = propertiesQuery.eq("user_id", scopeFilter);
      }

      const { data: leadsData } = await leadsQuery;
      const { data: propertiesData } = await propertiesQuery;

      const loadedLeads = (leadsData as unknown as Lead[]) || [];
      const loadedProperties = (propertiesData as unknown as Property[]) || [];

      setLeads(loadedLeads);
      setProperties(loadedProperties);

      const totalLeads = loadedLeads.length;
      const activeProperties = loadedProperties.filter(p => p.status === "available").length;
      const wonDeals = loadedLeads.filter(l => l.status === "won").length;
      const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;

      setMetrics({
        totalLeads,
        activeProperties,
        wonDeals,
        conversionRate
      });

    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter leads based on source
  const getFilteredLeads = () => {
    let filtered = [...leads];
    
    if (sourceFilter !== "all") {
      filtered = filtered.filter(l => l.source === sourceFilter);
    }
    
    return filtered;
  };

  // Get unique sources
  const getSources = () => {
    const sources = new Set(leads.map(l => l.source).filter(Boolean));
    return Array.from(sources);
  };

  // Commission Forecast Calculations
  const getCommissionForecast = () => {
    const filteredLeads = getFilteredLeads();
    const now = new Date();
    
    // Group by month buckets: 0-30, 31-60, 61-90 days
    const forecast = {
      next30: 0,
      next60: 0,
      next90: 0
    };

    filteredLeads.forEach(lead => {
      // Only consider leads in pipeline with estimated value and probability
      if (!(lead as any).estimated_value || !(lead as any).probability || lead.status === "won" || lead.status === "lost") {
        return;
      }

      const expectedValue = ((lead as any).estimated_value || 0) * (((lead as any).probability || 0) / 100);
      
      // If lead has expected_close_date, use it; otherwise distribute based on stage
      if ((lead as any).expected_close_date) {
        const closeDate = new Date((lead as any).expected_close_date);
        const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilClose <= 30) {
          forecast.next30 += expectedValue;
        } else if (daysUntilClose <= 60) {
          forecast.next60 += expectedValue;
        } else if (daysUntilClose <= 90) {
          forecast.next90 += expectedValue;
        }
      } else {
        // No close date, distribute based on pipeline stage probability
        // Higher probability = closer to closing = earlier bucket
        const probability = (lead as any).probability || 0;
        
        if (probability >= 70) {
          forecast.next30 += expectedValue;
        } else if (probability >= 40) {
          forecast.next60 += expectedValue;
        } else {
          forecast.next90 += expectedValue;
        }
      }
    });

    return [
      { period: "Próximos 30 dias", value: Math.round(forecast.next30), fill: "#10b981" },
      { period: "31-60 dias", value: Math.round(forecast.next60), fill: "#3b82f6" },
      { period: "61-90 dias", value: Math.round(forecast.next90), fill: "#8b5cf6" }
    ];
  };

  // Funnel Analysis with conversion rates
  const getFunnelAnalysis = () => {
    const filteredLeads = getFilteredLeads();
    
    // Define pipeline stages in order
    const stages = [
      { key: "new", label: "Novo", color: "#3b82f6" },
      { key: "contacted", label: "Contactado", color: "#10b981" },
      { key: "qualified", label: "Qualificado", color: "#f59e0b" },
      { key: "proposal", label: "Proposta", color: "#8b5cf6" },
      { key: "negotiation", label: "Negociação", color: "#ec4899" },
      { key: "won", label: "Fechado", color: "#22c55e" }
    ];

    const funnelData = stages.map((stage, index) => {
      const count = filteredLeads.filter(l => l.status === stage.key).length;
      
      // Calculate conversion rate from previous stage
      let conversionRate = 100;
      if (index > 0) {
        const prevCount = filteredLeads.filter(l => {
          const prevStageIndex = stages.findIndex(s => s.key === l.status);
          return prevStageIndex >= index - 1;
        }).length;
        
        if (prevCount > 0) {
          conversionRate = (count / prevCount) * 100;
        }
      }

      return {
        stage: stage.label,
        value: count,
        fill: stage.color,
        conversionRate: Math.round(conversionRate)
      };
    });

    // Identify biggest drop (leak)
    let biggestDrop = { from: "", to: "", dropRate: 0 };
    for (let i = 1; i < funnelData.length; i++) {
      const dropRate = 100 - funnelData[i].conversionRate;
      if (dropRate > biggestDrop.dropRate) {
        biggestDrop = {
          from: funnelData[i - 1].stage,
          to: funnelData[i].stage,
          dropRate: Math.round(dropRate)
        };
      }
    }

    return { funnelData, biggestDrop };
  };

  // Charts Data Prep
  const getLeadsByStatus = () => {
    const statusCounts: Record<string, number> = {};
    leads.forEach(l => {
      const status = l.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  };

  const getLeadsByType = () => {
    const typeCounts: Record<string, number> = {};
    leads.forEach(l => {
      const type = l.lead_type || "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  const { funnelData, biggestDrop } = getFunnelAnalysis();
  const forecastData = getCommissionForecast();
  const totalForecast = forecastData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Layout>
      {loading || !authorized ? (
        <div className="flex items-center justify-center h-full min-h-[600px] p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">A carregar relatórios...</p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
              <p className="text-muted-foreground">Análise de desempenho e métricas</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 3 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Imóveis Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeProperties}</div>
                <p className="text-xs text-muted-foreground">Disponíveis para venda</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Negócios Fechados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.wonDeals}</div>
                <p className="text-xs text-muted-foreground">Leads convertidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Média do período</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="forecast">Forecast de Comissões</TabsTrigger>
              <TabsTrigger value="funnel">Análise de Funil</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="properties">Imóveis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                  <CardHeader>
                    <CardTitle>Leads por Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={getLeadsByStatus()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="col-span-3">
                  <CardHeader>
                    <CardTitle>Distribuição por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={getLeadsByType()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getLeadsByType().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="forecast" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                      </CardTitle>
                      <CardDescription>Refine a análise por origem e âmbito</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-4">
                  {/* Scope Selector - Hierarchical */}
                  <ScopeSelector 
                    value={scopeFilter}
                    onChange={setScopeFilter}
                    label="Âmbito"
                  />

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todas as Origens" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Origens</SelectItem>
                      {getSources().map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(sourceFilter !== "all" || (scopeFilter !== "all" && currentUserRole !== "consultant")) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSourceFilter("all");
                        if (currentUserRole !== "consultant") {
                          setScopeFilter("all");
                        }
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Forecast Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Total Previsto (90d)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      €{totalForecast.toLocaleString("pt-PT")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Soma ponderada de {getFilteredLeads().filter(l => (l as any).estimated_value && (l as any).probability).length} leads
                    </p>
                  </CardContent>
                </Card>

                {forecastData.map((item, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{item.period}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" style={{ color: item.fill }}>
                        €{item.value.toLocaleString("pt-PT")}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {totalForecast > 0 ? Math.round((item.value / totalForecast) * 100) : 0}% do total
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Forecast Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Previsão de Comissões por Período</CardTitle>
                  <CardDescription>
                    Soma de (Valor Estimado × Probabilidade) agrupado por mês previsto de fecho
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`€${value.toLocaleString("pt-PT")}`, "Valor Previsto"]}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {forecastData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Breakdown by Source */}
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown por Origem</CardTitle>
                  <CardDescription>Contribuição de cada canal para o forecast</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getSources().map(source => {
                      const sourceLeads = leads.filter(l => l.source === source && (l as any).estimated_value && (l as any).probability);
                      const sourceValue = sourceLeads.reduce((sum, l) => 
                        sum + (((l as any).estimated_value || 0) * (((l as any).probability || 0) / 100)), 0
                      );
                      const percentage = totalForecast > 0 ? (sourceValue / totalForecast) * 100 : 0;

                      return (
                        <div key={source} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            <span className="text-sm font-medium">{source}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">{sourceLeads.length} leads</span>
                            <span className="text-sm font-bold">€{Math.round(sourceValue).toLocaleString("pt-PT")}</span>
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="funnel" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                      </CardTitle>
                      <CardDescription>Refine a análise por origem e âmbito</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-4">
                  {/* Scope Selector - Hierarchical */}
                  <ScopeSelector 
                    value={scopeFilter}
                    onChange={setScopeFilter}
                    label="Âmbito"
                  />

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todas as Origens" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Origens</SelectItem>
                      {getSources().map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(sourceFilter !== "all" || (scopeFilter !== "all" && currentUserRole !== "consultant")) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSourceFilter("all");
                        if (currentUserRole !== "consultant") {
                          setScopeFilter("all");
                        }
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Biggest Leak Alert */}
              {biggestDrop.dropRate > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-900">
                      <AlertTriangle className="h-5 w-5" />
                      Maior Fuga Identificada
                    </CardTitle>
                    <CardDescription className="text-amber-700">
                      Entre <strong>{biggestDrop.from}</strong> e <strong>{biggestDrop.to}</strong> há uma queda de <strong>{biggestDrop.dropRate}%</strong> das leads.
                      Foque-se em melhorar a conversão nesta etapa.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Funnel Visualization */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Funil de Conversão</CardTitle>
                    <CardDescription>Número de leads em cada etapa do pipeline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart 
                        data={funnelData} 
                        layout="vertical"
                        margin={{ left: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="stage" />
                        <Tooltip 
                          formatter={(value: any, name: string, props: any) => {
                            if (name === "value") {
                              return [`${value} leads`, "Quantidade"];
                            }
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {funnelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Taxas de Conversão por Etapa</CardTitle>
                    <CardDescription>Percentagem de leads que avançam para a próxima etapa</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {funnelData.map((stage, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{stage.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{stage.value} leads</span>
                              {index > 0 && (
                                <span 
                                  className={`text-sm font-bold ${
                                    stage.conversionRate >= 70 ? "text-green-600" :
                                    stage.conversionRate >= 40 ? "text-amber-600" :
                                    "text-red-600"
                                  }`}
                                >
                                  {stage.conversionRate}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${stage.conversionRate}%`,
                                backgroundColor: stage.fill
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Conversion Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle>Matriz de Conversão Detalhada</CardTitle>
                  <CardDescription>Análise de fluxo entre todas as etapas do pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Etapa</th>
                          <th className="text-right p-2">Leads</th>
                          <th className="text-right p-2">Taxa de Conversão</th>
                          <th className="text-right p-2">Perda</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funnelData.map((stage, index) => {
                          const dropRate = 100 - stage.conversionRate;
                          return (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{stage.stage}</td>
                              <td className="text-right p-2">{stage.value}</td>
                              <td className="text-right p-2">
                                {index === 0 ? "-" : `${stage.conversionRate}%`}
                              </td>
                              <td className="text-right p-2">
                                {index === 0 ? "-" : (
                                  <span className={dropRate > 50 ? "text-red-600 font-bold" : "text-gray-600"}>
                                    {dropRate.toFixed(0)}%
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                {index === 0 ? (
                                  <span className="text-xs text-gray-500">Entrada</span>
                                ) : stage.conversionRate >= 70 ? (
                                  <span className="text-xs text-green-600 font-medium">✓ Saudável</span>
                                ) : stage.conversionRate >= 40 ? (
                                  <span className="text-xs text-amber-600 font-medium">⚠ Atenção</span>
                                ) : (
                                  <span className="text-xs text-red-600 font-medium">✗ Crítico</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leads">
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes de Leads</CardTitle>
                  <CardDescription>Análise detalhada de aquisição de leads</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Funcionalidade de análise avançada em desenvolvimento.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="properties">
              <Card>
                <CardHeader>
                  <CardTitle>Performance de Imóveis</CardTitle>
                  <CardDescription>Tempo médio de venda e visualizações</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Funcionalidade de análise avançada em desenvolvimento.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Layout>
  );
}