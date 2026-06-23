import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeSwitch } from "./ThemeSwitch";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  CheckSquare,
  MessageSquare,
  TrendingUp,
  FileText,
  Shield,
  CreditCard,
  Settings,
  Calculator,
  FolderOpen,
  LogOut,
  Target,
  Handshake,
  Trophy,
  Send,
  Menu,
  X,
  Bot,
  Sparkles,
  Brain,
  ListTodo,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Contact2,
  PieChart,
  Home,
  GitMerge,
  BrainCircuit,
} from "lucide-react";

interface NavItem {
  icon: any;
  label: string;
  path?: string;
  subItems?: { icon: any; label: string; path: string }[];
}

export function Navigation() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isAdmin = profile?.role === "admin";
  const isTeamLead = profile?.role === "team_lead";

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  };

  const navItems: NavItem[] = [
    // Admin (apenas para admins)
    ...(isAdmin
      ? [
          {
            icon: Shield,
            label: "Admin",
            subItems: [
              { icon: LayoutDashboard, label: "Dashboard Admin", path: "/admin/dashboard" },
              { icon: Settings, label: "Integrações & Portais", path: "/admin/integrations" },
            ],
          },
        ]
      : []),
    
    // Main items
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: Target, label: "Pipeline", path: "/pipeline" },
    { icon: Building2, label: "Imóveis", path: "/properties" },
    { icon: Building2, label: "Empreendimentos", path: "/developments" },
    { icon: Users, label: "Contactos", path: "/contacts" },
    { icon: Calendar, label: "Agenda", path: "/calendar" },
    { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
    { icon: Sparkles, label: "Idealista", path: "/idealista" },
    
    // Performance Group
    { 
      icon: TrendingUp, 
      label: "Análise Desempenho", 
      subItems: [
        { icon: Handshake, label: "Negócios", path: "/deals" },
        { icon: Trophy, label: isAdmin || isTeamLead ? "Performance de Equipa" : "Performance", path: isAdmin || isTeamLead ? "/team-dashboard" : "/performance" },
        { icon: Target, label: "Objetivos", path: "/goals" },
        { icon: FileText, label: "Relatórios", path: "/reports" },
      ]
    },
    
    // Tools Group
    { 
      icon: Calculator, 
      label: "Ferramentas", 
      subItems: [
        { icon: Send, label: "Mensagens", path: "/bulk-messages" },
        { icon: Calculator, label: "Financiamento", path: "/financing" },
        { icon: FolderOpen, label: "Documentos", path: "/documents" },
      ]
    },

    // AI Group
    {
      icon: Sparkles,
      label: "Inteligência Artificial",
      subItems: [
        { icon: Bot, label: "Agente IA", path: "/ai-agent" },
        { icon: BrainCircuit, label: "Emails por Procura", path: "/ai-email-campaigns" },
        { icon: ListTodo, label: "Organizador Pessoal", path: "/ai-organizer" },
        { icon: Brain, label: "Coach de Performance", path: "/ai-performance-coach" },
      ]
    },
    
    // Settings
    { icon: CreditCard, label: "Subscrição", path: "/subscription" },
    { icon: Settings, label: "Definições", path: "/settings" },
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-center">
          <img 
            src="/vyxa-logo.png" 
            alt="Vyxa" 
            className="h-20 w-auto max-w-full object-contain"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            if (item.subItems) {
              const isExpanded = expandedGroups.includes(item.label);
              const isActiveSub = item.subItems.some(sub => router.pathname === sub.path);
              
              return (
                <div key={item.label} className="flex flex-col space-y-1 pt-1">
                  <Button
                    variant="ghost"
                    className={`w-full justify-between font-medium ${
                      item.label === "Admin"
                        ? isActiveSub
                          ? "text-red-600 bg-red-50/60"
                          : "text-red-600 hover:text-red-700 hover:bg-red-50"
                        : isActiveSub
                          ? "text-blue-600 bg-blue-50/50"
                          : "text-gray-700"
                    }`}
                    onClick={() => toggleGroup(item.label)}
                  >
                    <div className="flex items-center">
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.label}
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </Button>
                  {isExpanded && (
                    <div className="pl-4 space-y-1 mb-2 border-l-2 border-gray-100 ml-4">
                      {item.subItems.map(sub => {
                        const isSubActive = router.pathname === sub.path;
                        return (
                          <Button
                            key={sub.path}
                            variant={isSubActive ? "secondary" : "ghost"}
                            className={`w-full justify-start h-8 text-sm ${
                              isSubActive
                                ? item.label === "Admin"
                                  ? "font-medium text-red-700 bg-red-50"
                                  : "font-medium text-blue-700"
                                : item.label === "Admin"
                                  ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                                  : "text-gray-500 hover:text-gray-900"
                            }`}
                            onClick={() => router.push(sub.path)}
                          >
                            <sub.icon className="h-3.5 w-3.5 mr-2" />
                            {sub.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = router.pathname === item.path;
            const Icon = item.icon;
            const isAdminItem = item.path?.startsWith("/admin");

            return (
              <Button
                key={item.label}
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start ${
                  isAdminItem ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" : ""
                }`}
                onClick={() => item.path && router.push(item.path)}
              >
                <Icon className="h-4 w-4 mr-3" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );
}