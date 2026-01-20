import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Settings, 
  Shield, 
  CreditCard,
  Database,
  Workflow,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Palette,
  Plug,
  Mail,
  FileText
} from "lucide-react";
import { getAllUsers } from "@/services/adminService";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface DashboardStats {
  totalUsers: number;
  adminUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    adminUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersResult = await getAllUsers();
        
        if (usersResult.error) {
          console.error("Error loading users:", usersResult.error);
          // Set default values on error
          setStats(prev => ({
            ...prev,
            totalUsers: 0,
            adminUsers: 0,
          }));
        } else {
          const usersData = usersResult.data || [];
          const adminUsers = usersData.filter((u: any) => u.role === "admin");
          setStats(prev => ({
            ...prev,
            totalUsers: usersData.length,
            adminUsers: adminUsers.length,
          }));
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        // Set default values on error
        setStats(prev => ({
          ...prev,
          totalUsers: 0,
          adminUsers: 0,
        }));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const quickActions = [
    {
      title: "Gestão de Utilizadores",
      description: "Ver e gerir utilizadores do sistema",
      icon: Users,
      href: "/admin/users",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Subscrições",
      description: "Gerir planos e subscrições",
      icon: CreditCard,
      href: "/admin/subscriptions",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Métodos de Pagamento",
      description: "Configurar Stripe, EuPago e outros",
      icon: CreditCard,
      href: "/admin/payment-settings",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Segurança e Permissões",
      description: "Configurar roles e políticas de segurança",
      icon: Shield,
      href: "/admin/security",
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Definições do Sistema",
      description: "Configurações gerais da aplicação",
      icon: Settings,
      href: "/admin/system-settings",
      color: "text-slate-600",
      bgColor: "bg-slate-50",
    },
    {
      title: "Workflows Admin",
      description: "Automatizações e processos administrativos",
      icon: Workflow,
      href: "/admin/workflows",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Email Templates",
      description: "Personalizar templates de emails automáticos",
      icon: Mail,
      href: "/admin/email-templates",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Workflows Pessoal",
      description: "Gerir workflows pessoais",
      icon: Workflow,
      href: "/workflows",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Workflows Equipa",
      description: "Gerir workflows da equipa",
      icon: Workflow,
      href: "/team-workflows",
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
    {
      title: "Configurações Frontend",
      description: "Personalizar interface e colunas",
      icon: Palette,
      href: "/admin/frontend-settings",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "Integrações",
      description: "Configurar integrações externas",
      icon: Plug,
      href: "/admin/integrations",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
  ];

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">A carregar...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              🛠️ Painel de Administração
            </h1>
            <p className="text-slate-600 mt-2">
              Gerir e configurar o sistema Vyxa One
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Utilizadores
                </CardTitle>
                <Users className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {stats.adminUsers} administradores
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Subscrições Ativas
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                <p className="text-xs text-slate-600 mt-1">
                  Planos ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Receita Total
                </CardTitle>
                <CreditCard className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{stats.totalRevenue}</div>
                <p className="text-xs text-slate-600 mt-1">
                  Este mês
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Estado do Sistema
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Operacional
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Todos os serviços online
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Ações Rápidas
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Card
                    key={action.href}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(action.href)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`p-2 rounded-lg ${action.bgColor}`}>
                          <Icon className={`h-6 w-6 ${action.color}`} />
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400" />
                      </div>
                      <CardTitle className="text-lg mt-4">
                        {action.title}
                      </CardTitle>
                      <CardDescription>
                        {action.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Estado do Sistema
              </CardTitle>
              <CardDescription>
                Monitorização de serviços e integrações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">Base de Dados</p>
                      <p className="text-sm text-slate-600">Supabase PostgreSQL</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    Online
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">Autenticação</p>
                      <p className="text-sm text-slate-600">Supabase Auth</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    Online
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">Armazenamento</p>
                      <p className="text-sm text-slate-600">Supabase Storage</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    Online
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}