import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  CheckSquare,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  TrendingUp,
  Calculator,
  FolderOpen,
  CreditCard,
  Shield,
  Palette,
  LogOut,
  Trophy,
  UserSquare2,
  Kanban,
  UserPlus,
  FileSpreadsheet,
  Zap,
  Plug,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { getAppBranding } from "@/services/adminService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  icon: any;
  label: string;
  path: string;
  section?: "admin" | "main" | "tools" | "settings" | "automation";
}

export function Navigation() {
  const router = useRouter();
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [branding, setBranding] = useState<{ companyName: string; logo: string | null }>({
    companyName: "Vyxa",
    logo: null,
  });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const handleLogout = async () => {
    try {
      const { logout } = await import("@/services/authService");
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      alert("Erro ao fazer logout. Tente novamente.");
    }
  };

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await getAppBranding();
        setBranding(data);
      } catch (error) {
        console.error("Failed to load branding:", error);
      }
    };
    loadBranding();
  }, []);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          // Strict check: ONLY 'admin' role gets access
          if (profile && profile.role === "admin") {
            setIsUserAdmin(true);
          } else {
            setIsUserAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      } finally {
        setLoading(false);
      }
    };
    checkAdminStatus();
  }, []);

  const adminItems: NavItem[] = isUserAdmin ? [
    { icon: Shield, label: "Admin", path: "/admin/dashboard", section: "admin" },
    { icon: Users, label: "Utilizadores", path: "/admin/users", section: "admin" },
    { icon: CreditCard, label: "Subscrições", path: "/admin/subscriptions", section: "admin" },
    { icon: Settings, label: "Pagamentos", path: "/admin/payment-settings", section: "admin" },
    { icon: Palette, label: "Personalização", path: "/admin/system-settings", section: "admin" },
    { icon: Zap, label: "Workflows", path: "/admin/workflows", section: "admin" },
    { icon: Palette, label: "Frontend", path: "/admin/frontend-settings", section: "admin" },
    { icon: Plug, label: "Integrações", path: "/admin/integrations", section: "admin" },
  ] : [];

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/users", label: "Utilizadores" },
    { href: "/admin/subscriptions", label: "Subscrições" },
    { href: "/admin/payment-settings", label: "Pagamentos" },
    { href: "/admin/security", label: "Segurança" },
    { href: "/admin/system-settings", label: "Sistema" },
    { href: "/admin/workflows", label: "Workflows" },
    { href: "/admin/frontend-settings", label: "Frontend" },
    { href: "/admin/integrations", label: "Integrações" },
  ];

  const mainItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", section: "main" },
    { icon: Users, label: "Leads", path: "/leads", section: "main" },
    { icon: TrendingUp, label: "Pipeline", path: "/pipeline", section: "main" },
    { icon: Building2, label: "Imóveis", path: "/properties", section: "main" },
    { icon: UserSquare2, label: "Contactos", path: "/contacts", section: "main" },
    { icon: Calendar, label: "Agenda", path: "/calendar", section: "main" },
    { icon: CheckSquare, label: "Tarefas", path: "/tasks", section: "main" },
    { icon: MessageSquare, label: "Interações", path: "/interactions", section: "main" },
    { icon: Mail, label: "Mensagens em Massa", path: "/bulk-messages", section: "main" },
    { icon: FileText, label: "Templates", path: "/templates", section: "main" },
    { icon: BarChart3, label: "Relatórios", path: "/reports", section: "main" },
  ];

  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    const getUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            setUserRole(profile.role);
          }
        }
      } catch (error) {
        console.error("Error getting user role:", error);
      }
    };
    getUserRole();
  }, []);

  const toolsItems: NavItem[] = [
    { icon: Calculator, label: "Financiamento", path: "/financing", section: "tools" },
    // Show "Performance" for agents, "Performance Equipa" for admin/team_lead
    ...(userRole === "agent" 
      ? [{ icon: Trophy, label: "Performance", path: "/performance", section: "tools" as const }]
      : userRole === "admin" || userRole === "team_lead"
      ? [{ icon: Trophy, label: "Performance Equipa", path: "/team-dashboard", section: "tools" as const }]
      : []
    ),
    { icon: FolderOpen, label: "Documentos", path: "/documents", section: "tools" },
  ];

  const automationItems: NavItem[] = [
    { icon: Zap, label: "Workflows", path: "/workflows", section: "automation" },
    { icon: Zap, label: "Workflows Equipa", path: "/team-workflows", section: "automation" },
  ];

  const settingsItems: NavItem[] = [
    { icon: CreditCard, label: "Subscrição", path: "/subscription", section: "settings" },
    { icon: Settings, label: "Definições", path: "/settings", section: "settings" },
  ];

  const allNavItems = [...adminItems, ...mainItems, ...toolsItems, ...automationItems, ...settingsItems];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center justify-center border-b px-6">
        <img 
          src="/vyxa-logo.png"
          alt={branding.companyName}
          className="h-14 w-auto object-contain"
        />
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {allNavItems.map((item) => {
            const isActive = router.pathname === item.path;
            const isAdminItem = item.section === "admin";
            
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${isActive 
                    ? (isAdminItem 
                        ? "bg-red-600 text-white shadow-md" 
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                      )
                    : (isAdminItem
                        ? "text-gray-700 hover:bg-red-50"
                        : "text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
                      )
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );
}