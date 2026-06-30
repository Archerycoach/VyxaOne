import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSession } from "@/services/authService";
import { getUserProfile } from "@/services/profileService";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PipelineSettings } from "@/components/admin/PipelineSettings";
import { LeadSourceSettings } from "@/components/admin/LeadSourceSettings";
import { supabase } from "@/integrations/supabase/client";

interface ModuleSettings {
  leads: boolean;
  properties: boolean;
  tasks: boolean;
  calendar: boolean;
  reports: boolean;
  chat: boolean;
}

export default function SystemSettings() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<ModuleSettings>({
    leads: true,
    properties: true,
    tasks: true,
    calendar: true,
    reports: true,
    chat: true,
  });

  useEffect(() => {
    checkAccess();
    loadModuleSettings();
  }, []);

  const checkAccess = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const profile = await getUserProfile();
      if (profile?.role !== "admin") {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem aceder a esta página.",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadModuleSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("key", "active_modules")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.value && typeof data.value === 'string') {
        setModules(JSON.parse(data.value));
      }
    } catch (error) {
      console.error("Error loading module settings:", error);
    }
  };

  const handleModuleToggle = (module: keyof ModuleSettings) => {
    setModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const saveModuleSettings = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Sessão inválida");
      }

      const res = await fetch("/api/admin/system-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          active_modules: JSON.stringify(modules)
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao guardar");
      }

      toast({
        title: "✅ Módulos guardados",
        description: "As configurações dos módulos foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error saving module settings:", error);
      toast({
        title: "Erro ao guardar",
        description: error.message || "Não foi possível guardar as configurações dos módulos.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/admin/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-slate-900">
                  ⚙️ Configurações do Sistema
                </h1>
                <p className="text-slate-600 mt-2">
                  Gerir módulos, pipeline e configurações globais
                </p>
              </div>
            </div>
          </div>

          {/* Módulos Ativos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📦 Módulos Ativos
              </CardTitle>
              <CardDescription>
                Ativar ou desativar funcionalidades da aplicação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <Label htmlFor="leads-module" className="font-medium">Leads</Label>
                  <p className="text-sm text-slate-600">Gestão de leads e contactos</p>
                </div>
                <Switch
                  id="leads-module"
                  checked={modules.leads}
                  onCheckedChange={() => handleModuleToggle("leads")}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <Label htmlFor="properties-module" className="font-medium">Imóveis</Label>
                  <p className="text-sm text-slate-600">Base de dados de propriedades</p>
                </div>
                <Switch
                  id="properties-module"
                  checked={modules.properties}
                  onCheckedChange={() => handleModuleToggle("properties")}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <Label htmlFor="tasks-module" className="font-medium">Tarefas</Label>
                  <p className="text-sm text-slate-600">Sistema de gestão de tarefas</p>
                </div>
                <Switch
                  id="tasks-module"
                  checked={modules.tasks}
                  onCheckedChange={() => handleModuleToggle("tasks")}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <Label htmlFor="calendar-module" className="font-medium">Calendário</Label>
                  <p className="text-sm text-slate-600">Agenda e sincronização Google Calendar</p>
                </div>
                <Switch
                  id="calendar-module"
                  checked={modules.calendar}
                  onCheckedChange={() => handleModuleToggle("calendar")}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <Label htmlFor="reports-module" className="font-medium">Relatórios</Label>
                  <p className="text-sm text-slate-600">Relatórios e análises exportáveis</p>
                </div>
                <Switch
                  id="reports-module"
                  checked={modules.reports}
                  onCheckedChange={() => handleModuleToggle("reports")}
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <Label htmlFor="chat-module" className="font-medium">Chat</Label>
                  <p className="text-sm text-slate-600">Sistema de mensagens internas</p>
                </div>
                <Switch
                  id="chat-module"
                  checked={modules.chat}
                  onCheckedChange={() => handleModuleToggle("chat")}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={saveModuleSettings} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "A guardar..." : "Guardar Módulos"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Settings */}
          <PipelineSettings />

          {/* Lead Sources */}
          <LeadSourceSettings />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}