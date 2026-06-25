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
import { InfoIcon, ExternalLink, CheckCircle2, Settings, Activity } from "lucide-react";
import { MetaAppSettings } from "@/components/admin/MetaAppSettings";
import { ExternalPortalsSettings } from "@/components/settings/ExternalPortalsSettings";

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
  const [isTesting, setIsTesting] = useState(false);
  
  // Google Calendar Settings
  const [googleCalendar, setGoogleCalendar] = useState({
    client_id: "",
    client_secret: "",
    enabled: false
  });
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);

  // Notion Settings
  const [notion, setNotion] = useState({
    client_id: "",
    client_secret: "",
    enabled: false
  });
  const [isNotionConfigured, setIsNotionConfigured] = useState(false);

  // WhatsApp Global Settings
  const [whatsapp, setWhatsapp] = useState({
    access_token: "",
    business_account_id: "",
    verify_token: "",
    phone_number_id: "",
    template_name: "",
    enabled: false
  });
  const [isWhatsappConfigured, setIsWhatsappConfigured] = useState(false);

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
        const settings = (gcData.settings as any) || {};
        setGoogleCalendar({
          client_id: settings.client_id || "",
          client_secret: settings.client_secret || "",
          enabled: gcData.is_active || false
        });
        setIsGoogleConfigured(!!(settings.client_id && settings.client_secret));
      }

      // Load Notion settings
      const { data: notionData, error: notionError } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("integration_name", "notion")
        .maybeSingle();

      if (notionError) throw notionError;

      if (notionData) {
        const settings = (notionData.settings as any) || {};
        setNotion({
          client_id: settings.client_id || "",
          client_secret: settings.client_secret || "",
          enabled: notionData.is_active || false
        });
        setIsNotionConfigured(!!(settings.client_id && settings.client_secret));
      }

      // Load WhatsApp settings
      const { data: waData, error: waError } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("integration_name", "whatsapp_api")
        .maybeSingle();

      if (waError) throw waError;

      if (waData) {
        const settings = (waData.settings as any) || {};
        setWhatsapp({
          access_token: settings.access_token || "",
          business_account_id: settings.business_account_id || "",
          verify_token: settings.verify_token || "",
          phone_number_id: settings.phone_number_id || "",
          template_name: settings.template_name || "",
          enabled: waData.is_active || false
        });
        setIsWhatsappConfigured(!!(settings.access_token && settings.phone_number_id));
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

      const { error } = await supabase
        .from("integration_settings")
        .upsert({
          integration_name: "google_calendar",
          settings: {
            client_id: googleCalendar.client_id.trim(),
            client_secret: googleCalendar.client_secret.trim(),
            redirect_uri: `${window.location.origin}/api/google-calendar/callback`.trim(),
            scopes: ["https://www.googleapis.com/auth/calendar"]
          },
          is_active: googleCalendar.enabled,
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

  const handleSaveNotion = async () => {
    try {
      if (!notion.client_id || !notion.client_secret) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha Client ID e Client Secret do Notion.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const { error } = await supabase
        .from("integration_settings")
        .upsert({
          integration_name: "notion",
          settings: {
            client_id: notion.client_id.trim(),
            client_secret: notion.client_secret.trim(),
            redirect_uri: `${window.location.origin}/api/notion/callback`.trim()
          },
          is_active: notion.enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "integration_name"
        });

      if (error) throw error;

      setIsNotionConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações do Notion salvas com sucesso!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving Notion settings:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar configurações do Notion.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    try {
      if (!whatsapp.verify_token) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha pelo menos o Verify Token.",
          variant: "destructive",
        });
        return;
      }

      if (whatsapp.enabled && (!whatsapp.access_token || !whatsapp.business_account_id || !whatsapp.phone_number_id)) {
        toast({
          title: "Não é possível ativar",
          description: "Para ativar a integração, precisa preencher o Access Token, Account ID e o Phone Number ID.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const { error } = await supabase
        .from("integration_settings")
        .upsert({
          integration_name: "whatsapp_api",
          settings: {
            access_token: whatsapp.access_token.trim(),
            business_account_id: whatsapp.business_account_id.trim(),
            verify_token: whatsapp.verify_token.trim(),
            phone_number_id: whatsapp.phone_number_id.trim(),
            template_name: whatsapp.template_name.trim()
          },
          is_active: whatsapp.enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "integration_name"
        });

      if (error) throw error;

      setIsWhatsappConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações Globais do WhatsApp salvas!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving WhatsApp settings:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar configurações do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestGoogleCalendar = async () => {
    try {
      setIsTesting(true);
      const res = await fetch("/api/google-calendar/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "admin" })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ Teste Bem Sucedido", description: data.message });
      } else {
        toast({ title: "❌ Falha no Teste", description: data.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao testar a ligação.", variant: "destructive" });
    } finally {
      setIsTesting(false);
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

  const handleToggleNotionEnabled = async (enabled: boolean) => {
    try {
      if (!isNotionConfigured && enabled) {
        toast({
          title: "Configuração necessária",
          description: "Por favor, configure o Client ID e Client Secret do Notion primeiro.",
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
        .eq("integration_name", "notion");

      if (error) throw error;

      setNotion(prev => ({ ...prev, enabled }));
      toast({
        title: enabled ? "✅ Notion Ativado" : "⚠️ Notion Desativado",
        description: enabled 
          ? "Utilizadores podem agora conectar suas contas Notion." 
          : "Integração do Notion foi desativada.",
      });
    } catch (error: any) {
      console.error("Error toggling Notion:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar status do Notion.",
        variant: "destructive",
      });
    }
  };

  const handleToggleWhatsappEnabled = async (enabled: boolean) => {
    try {
      if (!isWhatsappConfigured && enabled) {
        toast({
          title: "Configuração necessária",
          description: "Configure o Access Token e Account ID primeiro.",
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
        .eq("integration_name", "whatsapp_api");

      if (error) throw error;

      setWhatsapp(prev => ({ ...prev, enabled }));
      toast({
        title: enabled ? "✅ WhatsApp Ativado" : "⚠️ WhatsApp Desativado",
      });
    } catch (error: any) {
      console.error("Error toggling WhatsApp:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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

  const handleClearNotionConfig = async () => {
    if (!confirm("Tem certeza que deseja limpar as configurações do Notion? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("integration_settings")
        .delete()
        .eq("integration_name", "notion");

      if (error) throw error;

      setNotion({
        client_id: "",
        client_secret: "",
        enabled: false
      });
      setIsNotionConfigured(false);

      toast({
        title: "✅ Configuração Limpa",
        description: "Configurações do Notion foram removidas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error clearing Notion config:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao limpar configurações do Notion.",
        variant: "destructive",
      });
    }
  };

  const generateVerifyToken = () => {
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setWhatsapp(prev => ({ ...prev, verify_token: newToken }));
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
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleTestGoogleCalendar}
                      disabled={isTesting}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      {isTesting ? "A testar..." : "Testar Ligação"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleClearGoogleConfig}
                    >
                      Limpar Configuração OAuth
                    </Button>
                  </>
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

          {/* WhatsApp Global API Integration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>WhatsApp Global API</CardTitle>
              </div>
              {isWhatsappConfigured && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <CardDescription>
                Credenciais centrais do Meta for Developers (System User). Ao configurar aqui, os utilizadores apenas precisarão de inserir o seu número de telemóvel para utilizar o WhatsApp na plataforma.
              </CardDescription>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">URL de Webhook (Coloque na consola da Meta):</p>
                  <code className="block bg-muted p-2 rounded text-sm">
                    {typeof window !== 'undefined' && `${window.location.origin}/api/whatsapp/webhook`}
                  </code>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>System User Access Token</Label>
                  <Input
                    type="password"
                    placeholder="EAA..."
                    value={whatsapp.access_token}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, access_token: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID</Label>
                  <Input
                    placeholder="Ex: 10423..."
                    value={whatsapp.business_account_id}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, business_account_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone Number ID (Número Central)</Label>
                  <Input
                    placeholder="Ex: 28472..."
                    value={whatsapp.phone_number_id}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, phone_number_id: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">ID do número único que será partilhado por todos os consultores.</p>
                </div>

                <div className="space-y-2">
                  <Label>Verify Token (Webhook)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Token para verificar o webhook na Meta"
                      value={whatsapp.verify_token}
                      onChange={(e) => setWhatsapp(prev => ({ ...prev, verify_token: e.target.value }))}
                    />
                    <Button variant="outline" onClick={generateVerifyToken}>Gerar</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Template Automático (Início de Conversa)</Label>
                  <Input
                    placeholder="Ex: ola_nova_lead"
                    value={whatsapp.template_name}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, template_name: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Nome do template aprovado na Meta para iniciar contacto automático com a Lead. Se deixado vazio, o disparo automático não ocorre.</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Ativar Integração Global</Label>
                    <p className="text-sm text-muted-foreground">
                      Disponibilizar o WhatsApp a todos os utilizadores
                    </p>
                  </div>
                  <Switch
                    checked={whatsapp.enabled}
                    onCheckedChange={handleToggleWhatsappEnabled}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveWhatsapp} disabled={saving}>
                  <Settings className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notion Integration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Notion</CardTitle>
              </div>
              {isNotionConfigured && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <CardDescription>
                Configure as credenciais do Notion Developers para permitir a sincronização de Leads e Imóveis
              </CardDescription>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Importante</p>
                  <p className="mb-2">Adicione esta URL de callback nas definições OAuth da sua integração no Notion:</p>
                  <code className="block bg-muted p-2 rounded text-sm">
                    {typeof window !== 'undefined' && `${window.location.origin}/api/notion/callback`}
                  </code>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notion-client-id">OAuth Client ID</Label>
                  <Input
                    id="notion-client-id"
                    type="text"
                    placeholder="Cole o Client ID da sua integração Notion"
                    value={notion.client_id}
                    onChange={(e) => setNotion(prev => ({ ...prev, client_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notion-client-secret">OAuth Client Secret</Label>
                  <Input
                    id="notion-client-secret"
                    type="password"
                    placeholder="Cole o Client Secret (ex: secret_...)"
                    value={notion.client_secret}
                    onChange={(e) => setNotion(prev => ({ ...prev, client_secret: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="notion-enabled">Ativar Integração</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que utilizadores conectem suas contas do Notion
                    </p>
                  </div>
                  <Switch
                    id="notion-enabled"
                    checked={notion.enabled}
                    onCheckedChange={handleToggleNotionEnabled}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSaveNotion}
                  disabled={saving}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>

                {isNotionConfigured && (
                  <Button
                    variant="destructive"
                    onClick={handleClearNotionConfig}
                  >
                    Limpar Configuração
                  </Button>
                )}

                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Notion Developers
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div id="external-portals">
            <ExternalPortalsSettings />
          </div>

          {/* Meta Lead Ads Integration */}
          <MetaAppSettings />
        </div>
      </div>
    </Layout>
  );
}