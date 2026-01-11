import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, Property } from "@/types";

export default function ReportsPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  
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
  }, [dateRange, authorized]);

  const checkAuth = async () => {
    try {
      // First check if we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.log("No valid session found, redirecting to login");
        router.push("/login");
        return;
      }

      // Session exists, user is authenticated
      setAuthorized(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      // If it's an AuthSessionMissingError, redirect to login
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
      
      // Calculate start date
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      const startDateStr = startDate.toISOString();

      // Fetch leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .gte("created_at", startDateStr);
      
      // Fetch properties
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("*")
        .gte("created_at", startDateStr);

      const loadedLeads = (leadsData as unknown as Lead[]) || [];
      const loadedProperties = (propertiesData as unknown as Property[]) || [];

      setLeads(loadedLeads);
      setProperties(loadedProperties);

      // Calculate metrics
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