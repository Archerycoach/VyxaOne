import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  AlertCircle,
  TrendingUp,
  Download,
  Copy
} from "lucide-react";
import Link from "next/link";
import { getMetaAppSettings, updateMetaAppSettings, type MetaAppSettings, getSyncHistory } from "@/services/metaService";
import { supabase } from "@/integrations/supabase/client";

export function MetaAppSettings() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [settings, setSettings] = useState<Partial<MetaAppSettings>>({
    app_id: "",
    app_secret: "",
    verify_token: "",
    webhook_url: "",
    is_active: false
  });
  const [notificationSettings, setNotificationSettings] = useState({
    notify_consultant: true,
    notify_client: false,
    consultant_email_template: "",
    client_email_template: "",
    notification_enabled: true
  });
  const [stats, setStats] = useState({
    total_integrations: 0,
    active_forms: 0,
    leads_24h: 0,
    leads_7d: 0,
    leads_30d: 0
  });
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    loadStats();
    loadSyncHistory();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getMetaAppSettings();
      if (data) {
        setSettings({
          id: data.id,
          app_id: data.app_id || "",
          app_secret: data.app_secret || "",
          verify_token: data.verify_token || "",
          webhook_url: `${window.location.origin}/api/meta/webhook`,
          is_active: data.is_active || false
        });
        
        if (data.is_active && data.app_id && data.app_secret) {
          setConnectionStatus("connected");
        }

        // Carregar configurações de notificações
        const { data: rawNotifData } = await supabase
          .from("meta_notification_settings" as any)
          .select("*")
          .maybeSingle();
        
        const notifData = rawNotifData as any;

        if (notifData) {
          setNotificationSettings({
            notify_consultant: notifData.notify_consultant ?? true,
            notify_client: notifData.notify_client ?? false,
            consultant_email_template: notifData.consultant_email_template || "",
            client_email_template: notifData.client_email_template || "",
            notification_enabled: notifData.notification_enabled ?? true
          });
        } else {
          // Criar configurações default se não existirem
          const { data: newNotifData, error: createError } = await supabase
            .from("meta_notification_settings" as any)
            .insert({
              notify_consultant: true,
              notify_client: false,
              consultant_email_template: "",
              client_email_template: "",
              notification_enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!createError && newNotifData) {
            const newData = newNotifData as any;
            setNotificationSettings({
              notify_consultant: newData.notify_consultant ?? true,
              notify_client: newData.notify_client ?? false,
              consultant_email_template: newData.consultant_email_template || "",
              client_email_template: newData.client_email_template || "",
              notification_enabled: newData.notification_enabled ?? true
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading Meta settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações da Meta.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const now = new Date();
      const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const { count: totalIntegrations } = await supabase
        .from("meta_integrations" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: activeForms } = await supabase
        .from("meta_form_configs" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: leads24h } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .not("meta_lead_id", "is", null)
        .gte("created_at", day24h.toISOString());

      const { count: leads7d } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .not("meta_lead_id", "is", null)
        .gte("created_at", day7d.toISOString());

      const { count: leads30d } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .not("meta_lead_id", "is", null)
        .gte("created_at", day30d.toISOString());

      setStats({
        total_integrations: totalIntegrations || 0,
        active_forms: activeForms || 0,
        leads_24h: leads24h || 0,
        leads_7d: leads7d || 0,
        leads_30d: leads30d || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_sync_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error && data) {
        setSyncHistory(data);
      }
    } catch (error) {
      console.error("Error loading sync history:", error);
    }
  };

  const handleSave = async () => {
    try {
      if (!settings.app_id || !settings.app_secret) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha App ID e App Secret.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      if (settings.id) {
        await updateMetaAppSettings(settings);
      } else {
        const { data, error } = await supabase
          .from("meta_app_settings" as any)
          .insert({
            app_id: settings.app_id,
            app_secret: settings.app_secret,
            verify_token: settings.verify_token,
            is_active: settings.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        setSettings({ ...settings, id: (data as any)?.id });
      }

      toast({
        title: "✅ Sucesso",
        description: "Configurações da Meta salvas com sucesso!",
      });

      await loadSettings();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      if (!settings.app_id || !settings.app_secret) {
        toast({
          title: "Configuração incompleta",
          description: "Configure App ID e App Secret primeiro.",
          variant: "destructive",
        });
        return;
      }

      setTesting(true);
      setConnectionStatus("unknown");

      const response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${settings.app_id}&client_secret=${settings.app_secret}&grant_type=client_credentials`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          setConnectionStatus("connected");
          toast({
            title: "✅ Conexão bem-sucedida",
            description: "Credenciais da Meta validadas com sucesso!",
          });
        } else {
          throw new Error("Invalid response");
        }
      } else {
        throw new Error("Failed to validate credentials");
      }
    } catch (error: any) {
      console.error("Error testing connection:", error);
      setConnectionStatus("error");
      toast({
        title: "❌ Erro de conexão",
        description: "Não foi possível validar as credenciais. Verifique App ID e App Secret.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    try {
      if (!settings.is_active) {
        toast({
          title: "Integração desativada",
          description: "Ative a integração primeiro para fazer sincronização.",
          variant: "destructive",
        });
        return;
      }

      setSyncing(true);

      const response = await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "✅ Sincronização concluída",
          description: `${data.leads_created || 0} leads criados, ${data.leads_skipped || 0} ignorados.`,
        });
        await loadStats();
        await loadSyncHistory();
      } else {
        throw new Error("Sync failed");
      }
    } catch (error: any) {
      console.error("Error syncing:", error);
      toast({
        title: "Erro",
        description: "Erro ao executar sincronização manual.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const generateVerifyToken = () => {
    const token = crypto.randomUUID();
    setSettings({ ...settings, verify_token: token });
  };

  const handleSaveNotifications = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("meta_notification_settings" as any)
        .upsert({
          notify_consultant: notificationSettings.notify_consultant,
          notify_client: notificationSettings.notify_client,
          consultant_email_template: notificationSettings.consultant_email_template,
          client_email_template: notificationSettings.client_email_template,
          notification_enabled: notificationSettings.notification_enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "id"
        });

      if (error) throw error;

      toast({
        title: "✅ Sucesso",
        description: "Configurações de notificações salvas!",
      });
    } catch (error: any) {
      console.error("Error saving notifications:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar notificações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ 
      title: "✅ Copiado!", 
      description: `${label} copiado para a área de transferência.` 
    });
  };

  const getStatusBadge = () => {
    if (!settings.is_active) {
      return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Desativada</Badge>;
    }
    
    switch (connectionStatus) {
      case "connected":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Conectada</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Não testada</Badge>;
    }
  };

  if (loading && !settings.app_id) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Carregando configurações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            Integração Meta (Facebook/Instagram)
            {getStatusBadge()}
          </CardTitle>
          <CardDescription>
            Configure as credenciais da sua App Meta para permitir captura automática de leads dos formulários.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Estatísticas */}
        {settings.is_active && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Páginas Conectadas</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total_integrations}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Formulários Ativos</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.active_forms}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Leads (24h)</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.leads_24h}</p>
                  </div>
                  <Download className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Leads (7 dias)</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.leads_7d}</p>
                  </div>
                  <Download className="h-8 w-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Leads (30 dias)</p>
                    <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.leads_30d}</p>
                  </div>
                  <Download className="h-8 w-8 text-indigo-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alertas */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">📋 Como configurar:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Crie uma App no <Link href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta for Developers</Link></li>
              <li>Adicione o produto "Webhooks" à sua App</li>
              <li>Configure o Webhook URL e Verify Token abaixo</li>
              <li>Subscreva aos eventos: <code className="bg-muted px-1 py-0.5 rounded">leadgen</code></li>
              <li>Os utilizadores poderão conectar suas Páginas nas configurações</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Toggle de Ativação */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="meta-active" className="text-base font-semibold">Ativar Integração Meta</Label>
            <p className="text-sm text-muted-foreground">
              Permitir que utilizadores conectem suas páginas Facebook/Instagram
            </p>
          </div>
          <Switch
            id="meta-active"
            checked={settings.is_active}
            onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
          />
        </div>

        {/* Credenciais da App */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="app_id">App ID *</Label>
            <Input
              id="app_id"
              value={settings.app_id}
              onChange={(e) => setSettings({ ...settings, app_id: e.target.value })}
              placeholder="Ex: 1234567890123456"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app_secret">App Secret *</Label>
            <Input
              id="app_secret"
              type="password"
              value={settings.app_secret}
              onChange={(e) => setSettings({ ...settings, app_secret: e.target.value })}
              placeholder="••••••••••••••••"
            />
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook_url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook_url"
                value={settings.webhook_url}
                readOnly
                className="bg-muted"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(settings.webhook_url || "", "Webhook URL")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure este URL no painel de Webhooks da sua Meta App.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify_token">Verify Token</Label>
            <div className="flex gap-2">
              <Input
                id="verify_token"
                value={settings.verify_token}
                onChange={(e) => setSettings({ ...settings, verify_token: e.target.value })}
                placeholder="Gere um token único"
              />
              <Button variant="outline" onClick={generateVerifyToken}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(settings.verify_token || "", "Verify Token")}
                disabled={!settings.verify_token}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use este token para verificar o webhook na Meta.
            </p>
          </div>
        </div>

        {/* Notificações Automáticas */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <AlertCircle className="h-5 w-5" />
              Notificações Automáticas por Email
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              Configure emails automáticos quando novas leads forem capturadas da Meta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle de ativação de notificações */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-1">
                <Label htmlFor="notification-enabled" className="text-base font-semibold">
                  Ativar Notificações Automáticas
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enviar emails automaticamente quando novas leads forem capturadas
                </p>
              </div>
              <Switch
                id="notification-enabled"
                checked={notificationSettings.notification_enabled}
                onCheckedChange={(checked) => 
                  setNotificationSettings({ ...notificationSettings, notification_enabled: checked })
                }
              />
            </div>

            {notificationSettings.notification_enabled && (
              <>
                {/* Opções de destinatários */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Switch
                      id="notify-consultant"
                      checked={notificationSettings.notify_consultant}
                      onCheckedChange={(checked) => 
                        setNotificationSettings({ ...notificationSettings, notify_consultant: checked })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="notify-consultant" className="font-semibold">
                        📧 Notificar Consultor
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        O agente responsável recebe um email com os detalhes da nova lead
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Switch
                      id="notify-client"
                      checked={notificationSettings.notify_client}
                      onCheckedChange={(checked) => 
                        setNotificationSettings({ ...notificationSettings, notify_client: checked })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="notify-client" className="font-semibold">
                        💌 Notificar Cliente
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        A lead (cliente) recebe um email de boas-vindas/confirmação
                      </p>
                    </div>
                  </div>
                </div>

                {/* Templates de Email */}
                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-800">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold mb-2">💡 Templates de Email:</p>
                    <p>Os templates de email podem ser personalizados na página <Link href="/admin/email-templates" className="underline font-semibold">Templates de Email</Link>.</p>
                    <p className="mt-1">Procure pelos templates:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">meta_lead_notification_consultant</code> - Para consultores</li>
                      <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">meta_lead_notification_client</code> - Para clientes</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Informação sobre SMTP */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <p className="font-semibold mb-1">⚙️ Configuração SMTP necessária:</p>
                    <p>Para que os emails funcionem, certifique-se de que:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>O consultor tem SMTP configurado nas suas definições</li>
                      <li>Ou existe uma configuração SMTP global do sistema</li>
                      <li>Os templates de email estão criados e ativos</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Botão para salvar notificações */}
                <Button onClick={handleSaveNotifications} disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações de Notificações
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Sincronização */}
        {settings.is_active && syncHistory.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Últimas Sincronizações</h3>
            <div className="space-y-2">
              {syncHistory.map((sync: any) => (
                <div key={sync.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    {sync.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : sync.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-orange-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {sync.sync_type === "manual" ? "Sincronização Manual" : "Sincronização Automática"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sync.created_at).toLocaleString("pt-PT")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{sync.leads_created || 0} criados</p>
                    <p className="text-xs text-muted-foreground">{sync.leads_skipped || 0} ignorados</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Configurações
          </Button>

          <Button 
            variant="outline" 
            onClick={handleTestConnection} 
            disabled={testing || !settings.app_id || !settings.app_secret}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Testar Conexão
          </Button>

          {settings.is_active && (
            <Button 
              variant="secondary" 
              onClick={handleManualSync} 
              disabled={syncing}
            >
              {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar Agora
            </Button>
          )}

          <Button variant="outline" asChild>
            <Link
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Meta Developers
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}