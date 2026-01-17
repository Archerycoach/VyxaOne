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
} from "lucide-react";

interface NavItem {
  icon: any;
  label: string;
  path: string;
}

export function Navigation() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

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

  const navItems: NavItem[] = [
    // Admin (apenas para admins)
    ...(isAdmin ? [{ icon: Shield, label: "Admin", path: "/admin/dashboard" }] : []),
    
    // Main items
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Handshake, label: "Negócios", path: "/deals" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: Target, label: "Pipeline", path: "/pipeline" },
    { icon: Building2, label: "Imóveis", path: "/properties" },
    { icon: Users, label: "Contactos", path: "/contacts" },
    { icon: Calendar, label: "Agenda", path: "/calendar" },
    { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
    { icon: MessageSquare, label: "Interações", path: "/interactions" },
    { icon: Send, label: "Mensagens", path: "/bulk-messages" },
    { icon: FileText, label: "Relatórios", path: "/reports" },
    
    // Tools
    { icon: Calculator, label: "Financiamento", path: "/financing" },
    { 
      icon: Trophy, 
      label: isAdmin || isTeamLead ? "Performance de Equipa" : "Performance", 
      path: isAdmin || isTeamLead ? "/team-dashboard" : "/performance" 
    },
    { icon: FolderOpen, label: "Documentos", path: "/documents" },
    
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
            className="h-12 w-auto"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = router.pathname === item.path;
            const Icon = item.icon;
            const isAdminItem = item.path.startsWith("/admin");

            return (
              <Button
                key={item.path}
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start ${
                  isAdminItem ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" : ""
                }`}
                onClick={() => router.push(item.path)}
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