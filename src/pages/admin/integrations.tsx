import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Loader2, CheckCircle2, XCircle, RefreshCw, Settings, AlertCircle, Eye, EyeOff, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import type { Database } from "@/integrations/supabase/types";

type GoogleCalendarIntegration = {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  calendar_id: string | null;
  sync_events: boolean | null;
  sync_tasks: boolean | null;
  sync_notes: boolean | null;
  sync_direction: "both" | "toGoogle" | "fromGoogle" | null;
  auto_sync: boolean | null;
  last_sync_at: string | null;
  webhook_channel_id: string | null;
  webhook_expiration: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type IntegrationSettings = {
  id: string;
  service_name: string;
  client_id: string | null;
  client_secret: string | null;
  redirect_uri: string | null;
  scopes: string[] | null;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

interface SyncSettings {
  syncEvents: boolean;
  syncTasks: boolean;
  syncNotes: boolean;
  syncDirection: "both" | "toGoogle" | "fromGoogle";
  autoSync: boolean;
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [integration, setIntegration] = useState<GoogleCalendarIntegration | null>(null);
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    syncEvents: true,
    syncTasks: true,
    syncNotes: false,
    syncDirection: "both",
    autoSync: true,
  });
  const [configForm, setConfigForm] = useState({
    clientId: "",
    clientSecret: "",
    enabled: false,
  });
  const [googleSettings, setGoogleSettings] = useState({
    enabled: false,
    clientId: "",
    clientSecret: "",
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadIntegration(), loadSettings()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      console.log("[Integrations] Loading Google Calendar settings...");
      const response = await fetch("/api/google-calendar/settings");
      
      console.log("[Integrations] Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Integrations] Settings API error:", errorData);
        throw new Error(errorData.error || "Failed to load settings");
      }

      const data = await response.json();
      console.log("[Integrations] Settings loaded:", data);
      
      // Handle null or empty settings
      if (data) {
        setSettings(data);
        setConfigForm({
          clientId: data.client_id || "",
          clientSecret: data.client_secret || "",
          enabled: data.enabled || false,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
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

      const { data, error } = await supabase
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const integrationData = data as unknown as GoogleCalendarIntegration;
        setIntegration(integrationData);
        setSyncSettings({
          syncEvents: integrationData.sync_events ?? true,
          syncTasks: integrationData.sync_tasks ?? true,
          syncNotes: integrationData.sync_notes ?? false,
          syncDirection: (integrationData.sync_direction as any) ?? "both",
          autoSync: integrationData.auto_sync ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading integration:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de integração",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);

      if (!configForm.clientId || !configForm.clientSecret) {
        toast({
          title: "Erro",
          description: "Client ID e Client Secret são obrigatórios",
          variant: "destructive",
        });
        return;
      }

      // Calculate redirect URI dynamically
      const redirectUri = typeof window !== "undefined" 
        ? `${window.location.origin}/api/google-calendar/callback`
        : "";

      const response = await fetch("/api/google-calendar/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: configForm.clientId,
          clientSecret: configForm.clientSecret,
          redirectUri: redirectUri,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          enabled: configForm.enabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      const data = await response.json();
      
      // Reload settings to confirm they were saved
      await loadSettings();

      toast({
        title: "Sucesso",
        description: "Configurações do Google Calendar salvas com sucesso",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setLoading(true);

      if (!settings?.client_id) {
        toast({
          title: "Configuração necessária",
          description: "Configure as credenciais do Google Calendar primeiro",
          variant: "destructive",
        });
        return;
      }

      if (!settings.enabled) {
        toast({
          title: "Integração desativada",
          description: "Ative a integração do Google Calendar nas configurações",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const redirectUrl = `${window.location.origin}/api/google-calendar/callback`;
      const scope = (settings.scopes || []).join(" ");

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("client_id", settings.client_id);
      authUrl.searchParams.append("redirect_uri", redirectUrl);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("scope", scope);
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("prompt", "consent");
      authUrl.searchParams.append("state", user.id);

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error("Error connecting to Google:", error);
      toast({
        title: "Erro",
        description: "Erro ao conectar com Google Calendar",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const handleSyncSettingsUpdate = async (newSettings: Partial<SyncSettings>) => {
    try {
      const updatedSettings = { ...syncSettings, ...newSettings };
      setSyncSettings(updatedSettings);

      if (!integration) return;

      const { error } = await supabase
        .from("google_calendar_integrations" as any)
        .update({
          sync_events: updatedSettings.syncEvents,
          sync_tasks: updatedSettings.syncTasks,
          sync_notes: updatedSettings.syncNotes,
          sync_direction: updatedSettings.syncDirection,
          auto_sync: updatedSettings.autoSync,
        })
        .eq("id", integration.id);

      if (error) throw error;

      toast({
        title: "Configurações atualizadas",
        description: "Preferências de sincronização salvas com sucesso",
      });
    } catch (error) {
      console.error("Error updating sync settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive",
      });
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);

      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Sync failed");

      const result = await response.json();

      toast({
        title: "Sincronização completa",
        description: `${result.synced} items sincronizados com sucesso`,
      });

      await loadIntegration();
    } catch (error) {
      console.error("Error syncing:", error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar calendário",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = !!integration;
  const isTokenValid = integration && integration.expires_at && new Date(integration.expires_at) > new Date();
  const isConfigured = !!(settings?.client_id && settings?.client_secret);

  const saveGoogleSettings = async () => {
    setIsSavingSettings(true);
    try {
      // Calculate redirect URI based on current origin
      const redirectUri = `${window.location.origin}/api/google-calendar/callback`;
      
      const response = await fetch("/api/google-calendar/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...googleSettings,
          redirectUri,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
        }),
      });
    } catch (error) {
      console.error("Error saving Google settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações do Google",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout>
        <SEO
          title="Integrações - Admin"
          description="Configure integrações com serviços externos"
        />
        
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Integrações</h1>
            <p className="text-muted-foreground">
              Configure e gerencie integrações com serviços externos
            </p>
          </div>

          <Tabs defaultValue="google-calendar" className="space-y-6">
            <TabsList>
              <TabsTrigger value="google-calendar">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Google Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google-calendar" className="space-y-6">
              {/* Configuration Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Configuração OAuth
                      </CardTitle>
                      <CardDescription>
                        Configure as credenciais do Google Cloud Console
                      </CardDescription>
                    </div>
                    {isConfigured && (
                      <Badge variant={settings?.enabled ? "default" : "secondary"}>
                        {settings?.enabled ? "Ativo" : "Inativo"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Para conectar o Google Calendar, você precisa criar credenciais OAuth 2.0 no{" "}
                          <a
                            href="https://console.cloud.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Google Cloud Console
                          </a>
                          . Use a URL de redirecionamento:
                          <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                            {typeof window !== "undefined" 
                              ? `${window.location.origin}/api/google-calendar/callback`
                              : "https://your-domain.com/api/google-calendar/callback"}
                          </code>
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="client-id">Client ID</Label>
                          <Input
                            id="client-id"
                            type="text"
                            placeholder="123456789-abc.apps.googleusercontent.com"
                            value={configForm.clientId}
                            onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client-secret">Client Secret</Label>
                          <div className="relative">
                            <Input
                              id="client-secret"
                              type={showClientSecret ? "text" : "password"}
                              placeholder="GOCSPX-..."
                              value={configForm.clientSecret}
                              onChange={(e) => setConfigForm({ ...configForm, clientSecret: e.target.value })}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowClientSecret(!showClientSecret)}
                            >
                              {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="space-y-0.5">
                            <Label htmlFor="enable-integration">Ativar Integração</Label>
                            <p className="text-sm text-muted-foreground">
                              Permitir que utilizadores conectem suas contas
                            </p>
                          </div>
                          <Switch
                            id="enable-integration"
                            checked={configForm.enabled}
                            onCheckedChange={(checked) => setConfigForm({ ...configForm, enabled: checked })}
                          />
                        </div>

                        <Button
                          onClick={handleSaveSettings}
                          disabled={savingSettings}
                          className="w-full"
                        >
                          {savingSettings ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Salvar Configurações
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Connection Status Card */}
              {isConfigured && settings?.enabled && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5" />
                          Sua Conexão
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Google para sincronizar
                        </CardDescription>
                      </div>
                      {isConnected && (
                        <Badge variant={isTokenValid ? "default" : "destructive"}>
                          {isTokenValid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Conectado
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Token Expirado
                            </>
                          )}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isConnected ? (
                      <div className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Conecte sua conta Google para sincronizar eventos automaticamente entre o sistema e seu Google Calendar.
                          </AlertDescription>
                        </Alert>
                        <Button onClick={handleGoogleConnect} className="w-full">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          Conectar Google Calendar
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Email conectado:</span>
                            <span className="font-medium">{integration.google_email}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Última sincronização:</span>
                            <span className="font-medium">
                              {integration.last_sync_at
                                ? new Date(integration.last_sync_at).toLocaleString("pt-PT")
                                : "Nunca"}
                            </span>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2">
                          <Button
                            onClick={handleManualSync}
                            disabled={syncing || !isTokenValid}
                            variant="outline"
                            className="flex-1"
                          >
                            {syncing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Sincronizar Agora
                          </Button>
                          <Button
                            onClick={handleDisconnect}
                            variant="destructive"
                            disabled={loading}
                          >
                            Desconectar
                          </Button>
                        </div>

                        {!isTokenValid && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Token de acesso expirado. Reconecte sua conta para continuar sincronizando.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sync Settings Card */}
              {isConnected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Configurações de Sincronização
                    </CardTitle>
                    <CardDescription>
                      Personalize o que será sincronizado com seu Google Calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">O que sincronizar:</h3>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sync-events">Eventos do Calendário</Label>
                          <p className="text-sm text-muted-foreground">
                            Sincronizar visitas, reuniões e compromissos
                          </p>
                        </div>
                        <Switch
                          id="sync-events"
                          checked={syncSettings.syncEvents}
                          onCheckedChange={(checked) =>
                            handleSyncSettingsUpdate({ syncEvents: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sync-tasks">Tarefas</Label>
                          <p className="text-sm text-muted-foreground">
                            Sincronizar tarefas como eventos
                          </p>
                        </div>
                        <Switch
                          id="sync-tasks"
                          checked={syncSettings.syncTasks}
                          onCheckedChange={(checked) =>
                            handleSyncSettingsUpdate({ syncTasks: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sync-notes">Notas de Interações</Label>
                          <p className="text-sm text-muted-foreground">
                            Incluir notas nas descrições dos eventos
                          </p>
                        </div>
                        <Switch
                          id="sync-notes"
                          checked={syncSettings.syncNotes}
                          onCheckedChange={(checked) =>
                            handleSyncSettingsUpdate({ syncNotes: checked })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Direção da sincronização:</h3>
                      
                      <div className="space-y-2">
                        <div
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            syncSettings.syncDirection === "both"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => handleSyncSettingsUpdate({ syncDirection: "both" })}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Bidirecional</p>
                              <p className="text-sm text-muted-foreground">
                                Sincronizar mudanças em ambas as direções
                              </p>
                            </div>
                            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                              {syncSettings.syncDirection === "both" && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            syncSettings.syncDirection === "toGoogle"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => handleSyncSettingsUpdate({ syncDirection: "toGoogle" })}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Sistema → Google</p>
                              <p className="text-sm text-muted-foreground">
                                Apenas enviar do sistema para Google Calendar
                              </p>
                            </div>
                            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                              {syncSettings.syncDirection === "toGoogle" && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            syncSettings.syncDirection === "fromGoogle"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => handleSyncSettingsUpdate({ syncDirection: "fromGoogle" })}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Google → Sistema</p>
                              <p className="text-sm text-muted-foreground">
                                Apenas importar do Google Calendar para o sistema
                              </p>
                            </div>
                            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                              {syncSettings.syncDirection === "fromGoogle" && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-sync">Sincronização Automática</Label>
                        <p className="text-sm text-muted-foreground">
                          Sincronizar automaticamente a cada 15 minutos
                        </p>
                      </div>
                      <Switch
                        id="auto-sync"
                        checked={syncSettings.autoSync}
                        onCheckedChange={(checked) =>
                          handleSyncSettingsUpdate({ autoSync: checked })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}