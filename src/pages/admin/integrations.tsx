import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Settings, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface GoogleCalendarSettings {
  client_id: string | null;
  client_secret: string | null;
  enabled: boolean;
  redirect_uri: string | null;
  scopes: string | null;
}

interface GoogleCalendarIntegration {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string | null;
  sync_direction: string;
  sync_events: boolean;
  sync_tasks: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState({
    client_id: "",
    client_secret: "",
    redirect_uri: "",
    enabled: false,
    scopes: "",
  });
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncSettings, setSyncSettings] = useState({
    sync_direction: "both" as "both" | "fromGoogle" | "toGoogle",
    sync_events: true,
    sync_tasks: true,
  });

  // Client-only state for callback URL to prevent hydration mismatch
  const [callbackUrl, setCallbackUrl] = useState("https://www.vyxa.pt/api/google-calendar/callback");

  // Set callback URL only on client-side after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCallbackUrl(`${window.location.origin}/api/google-calendar/callback`);
    }
  }, []);

  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      console.log("[Integrations] Loading Google Calendar settings...");
      
      const { data, error } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .maybeSingle();

      if (error) {
        console.error("[Integrations] ❌ Error loading settings:", error);
        throw error;
      }

      const settingsData = data as any;
      console.log("[Integrations] ✅ Settings loaded:", {
        hasData: !!settingsData,
        enabled: settingsData?.enabled,
        hasClientId: !!settingsData?.client_id
      });

      if (settingsData) {
        setSettings({
          client_id: settingsData.client_id || "",
          client_secret: settingsData.client_secret || "",
          enabled: settingsData.enabled || false,
          redirect_uri: settingsData.redirect_uri || "",
          scopes: settingsData.scopes || "",
        });
      }
    } catch (error) {
      console.error("[Integrations] Error loading settings:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao carregar configurações",
        variant: "destructive",
      });
    }
  };

  const loadIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log("[Integrations] Loading integration for user:", user.id);

      const { data, error } = await supabase
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[Integrations] ❌ Error loading integration:", error);
        return;
      }

      const integrationData = data as any;
      console.log("[Integrations] ✅ Integration loaded:", {
        hasData: !!integrationData,
        email: integrationData?.google_email
      });

      setIntegration(integrationData);
    } catch (error) {
      console.error("[Integrations] Error loading integration:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de integração",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadSettings();
    loadIntegration();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update integration settings
      const { error } = await supabase
        .from("integration_settings" as any)
        .upsert({
          user_id: user.id,
          provider: "google_calendar",
          client_id: settings.client_id,
          client_secret: settings.client_secret,
          redirect_uri: settings.redirect_uri || callbackUrl,
          enabled: settings.enabled,
          scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações do Google Calendar foram atualizadas com sucesso",
      });

      await loadSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Google Calendar? Isso removerá todas as configurações de sincronização.")) {
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("google_calendar_integrations" as any)
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setIntegration(null);
      toast({
        title: "Desconectado",
        description: "Google Calendar desconectado com sucesso",
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar Google Calendar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = !!(settings.client_id && settings.client_secret);
  const isConnected = !!integration;
  const isTokenValid = integration && new Date(integration.expires_at).getTime() > new Date().getTime();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">
            Configure e gerencie integrações com serviços externos
          </p>
        </div>

        <Tabs defaultValue="google-calendar" className="w-full">
          <TabsList>
            <TabsTrigger value="google-calendar">
              <Calendar className="w-4 h-4 mr-2" />
              Google Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google-calendar" className="space-y-6">
            {/* Configuration Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <CardTitle>Configuração OAuth</CardTitle>
                  </div>
                  {settings.enabled ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="w-3 h-3 mr-1" />
                      Inativo
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Configure as credenciais do Google Cloud Console
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Importante</AlertTitle>
                  <AlertDescription>
                    Adicione esta URL de callback no Google Cloud Console:
                    <br />
                    <code className="bg-muted px-2 py-1 rounded text-sm mt-2 block">
                      {callbackUrl}
                    </code>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client ID</Label>
                    <Input
                      id="client_id"
                      value={settings.client_id || ""}
                      onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
                      placeholder="123456789-abc.apps.googleusercontent.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_secret">Client Secret</Label>
                    <Input
                      id="client_secret"
                      type="password"
                      value={settings.client_secret || ""}
                      onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
                      placeholder="GOCSPX-..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={settings.enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                    />
                    <Label htmlFor="enabled">Ativar Integração</Label>
                    <span className="text-sm text-muted-foreground">
                      Permitir que utilizadores conectem suas contas
                    </span>
                  </div>

                  <Button onClick={handleSaveSettings} disabled={loading}>
                    <Settings className="w-4 h-4 mr-2" />
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connection Status Card */}
            {isConfigured && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Sua Conexão</CardTitle>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        isTokenValid ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Conectado
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Token Expirado
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Não Conectado
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isConnected && integration ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">Email</Label>
                          <p className="font-medium">{integration.google_email}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Calendar ID</Label>
                          <p className="font-medium">{integration.calendar_id || "primary"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Conectado em</Label>
                          <p className="font-medium">
                            {new Date(integration.created_at).toLocaleDateString("pt-PT")}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Última Sincronização</Label>
                          <p className="font-medium">
                            {integration.last_sync_at
                              ? new Date(integration.last_sync_at).toLocaleString("pt-PT")
                              : "Nunca"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Token Expira em</Label>
                          <p className="font-medium">
                            {new Date(integration.expires_at).toLocaleString("pt-PT")}
                          </p>
                        </div>
                      </div>

                      <Button 
                        onClick={handleDisconnect} 
                        variant="destructive"
                        disabled={loading}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Desconectar Google Calendar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Você ainda não conectou sua conta do Google Calendar. Clique no botão abaixo para autorizar o acesso.
                      </p>
                      <Button onClick={() => window.location.href = "/calendar"}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Conectar Google Calendar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sync Settings - Only show if connected */}
            {isConnected && integration && (
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Sincronização</CardTitle>
                  <CardDescription>
                    Configure como seus eventos são sincronizados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Direção da Sincronização</Label>
                    <p className="text-sm text-muted-foreground">
                      Atual: <strong>{integration.sync_direction}</strong>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sincronizar Eventos</Label>
                    <p className="text-sm text-muted-foreground">
                      {integration.sync_events ? "Sim" : "Não"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sincronizar Tarefas</Label>
                    <p className="text-sm text-muted-foreground">
                      {integration.sync_tasks ? "Sim" : "Não"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}