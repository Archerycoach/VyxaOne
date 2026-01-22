import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InfoIcon, ExternalLink, CheckCircle2, Settings } from "lucide-react";
import { MetaAppSettings } from "@/components/admin/MetaAppSettings";

// Define interface for the settings JSON structure
interface GoogleCalendarSettings {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
}

export default function Integrations() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Google Calendar Settings
  const [googleCalendar, setGoogleCalendar] = useState({
    client_id: "",
    client_secret: "",
    enabled: false
  });
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);

  useEffect(() => {
    loadIntegrationSettings();
  }, []);

  const loadIntegrationSettings = async () => {
    try {
      setLoading(true);

      const { data: gcData, error: gcError } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("integration_name", "google_calendar")
        .maybeSingle();

      if (gcError) throw gcError;

      if (gcData) {
        // Cast settings to unknown first, then to our interface to handle Json type safely
        const settings = gcData.settings as unknown as GoogleCalendarSettings;
        
        setGoogleCalendar({
          client_id: settings?.client_id || "",
          client_secret: settings?.client_secret || "",
          enabled: gcData.is_active || false
        });
        setIsGoogleConfigured(!!(settings?.client_id && settings?.client_secret));
      }

    } catch (error: any) {
      console.error("Error loading integration settings:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar configurações de integrações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoogleCalendar = async () => {
    try {
      if (!googleCalendar.client_id || !googleCalendar.client_secret) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha Client ID e Client Secret.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const settings: GoogleCalendarSettings = {
        client_id: googleCalendar.client_id,
        client_secret: googleCalendar.client_secret,
        redirect_uri: `${window.location.origin}/api/google-calendar/callback`
      };

      const { error } = await supabase
        .from("integration_settings")
        .upsert({
          integration_name: "google_calendar",
          client_id: googleCalendar.client_id.trim(),
          client_secret: googleCalendar.client_secret.trim(),
          redirect_uri: `${window.location.origin}/api/google-calendar/callback`.trim(),
          scopes: ["https://www.googleapis.com/auth/calendar"],
          enabled: googleCalendar.enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "integration_name"
        });

      if (error) throw error;

      setIsGoogleConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações do Google Calendar salvas com sucesso!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving Google Calendar settings:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGoogleEnabled = async (enabled: boolean) => {
    try {
      if (!isGoogleConfigured && enabled) {
        toast({
          title: "Configuração necessária",
          description: "Por favor, configure o Client ID e Client Secret primeiro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("integration_settings")
        .update({ 
          is_active: enabled,
          updated_at: new Date().toISOString()
        })
        .eq("integration_name", "google_calendar");

      if (error) throw error;

      setGoogleCalendar(prev => ({ ...prev, enabled }));
      toast({
        title: enabled ? "✅ Integração Ativada" : "⚠️ Integração Desativada",
        description: enabled 
          ? "Utilizadores podem agora conectar suas contas Google Calendar." 
          : "Integração do Google Calendar foi desativada.",
      });
    } catch (error: any) {
      console.error("Error toggling Google Calendar:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar status.",
        variant: "destructive",
      });
    }
  };

  const handleClearGoogleConfig = async () => {
    if (!confirm("Tem certeza que deseja limpar as configurações OAuth do Google Calendar? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("integration_settings")
        .delete()
        .eq("integration_name", "google_calendar");

      if (error) throw error;

      setGoogleCalendar({
        client_id: "",
        client_secret: "",
        enabled: false
      });
      setIsGoogleConfigured(false);

      toast({
        title: "✅ Configuração Limpa",
        description: "Configurações do Google Calendar foram removidas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error clearing Google Calendar config:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao limpar configurações.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <p>Carregando configurações...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Configurações de Integrações</h1>
          <p className="text-muted-foreground">
            Configure as integrações externas para expandir as funcionalidades do CRM
          </p>
        </div>

        <div className="space-y-6">
          {/* Google Calendar Integration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Google Calendar</CardTitle>
              </div>
              {isGoogleConfigured && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <CardDescription>
                Configure as credenciais do Google Cloud Console para permitir integração com Google Calendar
              </CardDescription>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Importante</p>
                  <p className="mb-2">Adicione esta URL de callback no Google Cloud Console:</p>
                  <code className="block bg-muted p-2 rounded text-sm">
                    {typeof window !== 'undefined' && `${window.location.origin}/api/google-calendar/callback`}
                  </code>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gc-client-id">Client ID</Label>
                  <Input
                    id="gc-client-id"
                    type="text"
                    placeholder="540924658202-xxxxxxxxxxxx.apps.googleusercontent.com"
                    value={googleCalendar.client_id}
                    onChange={(e) => setGoogleCalendar(prev => ({ ...prev, client_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gc-client-secret">Client Secret</Label>
                  <Input
                    id="gc-client-secret"
                    type="password"
                    placeholder="GOCSPX-xxxxxxxxxxxx"
                    value={googleCalendar.client_secret}
                    onChange={(e) => setGoogleCalendar(prev => ({ ...prev, client_secret: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="gc-enabled">Ativar Integração</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que utilizadores conectem suas contas
                    </p>
                  </div>
                  <Switch
                    id="gc-enabled"
                    checked={googleCalendar.enabled}
                    onCheckedChange={handleToggleGoogleEnabled}
                    disabled={!isGoogleConfigured}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSaveGoogleCalendar}
                  disabled={saving}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>

                {isGoogleConfigured && (
                  <Button
                    variant="destructive"
                    onClick={handleClearGoogleConfig}
                  >
                    Limpar Configuração OAuth
                  </Button>
                )}

                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Google Cloud Console
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meta Lead Ads Integration */}
          <MetaAppSettings />
        </div>
      </div>
    </Layout>
  );
}