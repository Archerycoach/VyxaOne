import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InfoIcon, ExternalLink, CheckCircle2, Settings, Activity, ShieldCheck } from "lucide-react";
import { MetaAppSettings } from "@/components/admin/MetaAppSettings";
import { ExternalPortalsSettings } from "@/components/settings/ExternalPortalsSettings";

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

  // Idealista Settings
  const [idealistaConfigured, setIdealistaConfigured] = useState(false);
  const [idealistaKey, setIdealistaKey] = useState("");
  const [idealistaMaskedKey, setIdealistaMaskedKey] = useState("");
  const [idealistaHost, setIdealistaHost] = useState("idealista2.p.rapidapi.com");
  const [idealistaEndpoint, setIdealistaEndpoint] = useState("/properties/list");
  const [idealistaAutoSuggest, setIdealistaAutoSuggest] = useState(false);
  const [idealistaAgencyFilter, setIdealistaAgencyFilter] = useState("");

  // Helper para fetch seguro
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });
  };

  useEffect(() => {
    loadIntegrationSettings();
    loadIdealistaSettings();
  }, []);

  const loadIdealistaSettings = async () => {
    try {
      const res = await adminFetch("/api/admin/system-settings?keys=idealista");
      if (!res.ok) return;
      
      const data = await res.json();
      
      setIdealistaConfigured(data.idealista_configured || false);
      setIdealistaMaskedKey(data.idealista_key_masked || "");
      setIdealistaHost(data.idealista_rapidapi_host || "idealista2.p.rapidapi.com");
      setIdealistaEndpoint(data.idealista_rapidapi_list_endpoint || "/properties/list");
      setIdealistaAutoSuggest(data.idealista_auto_suggest_enabled === "true");
      setIdealistaAgencyFilter(data.idealista_agency_filter || "");
    } catch (error) {
      console.error("Error loading Idealista settings:", error);
    }
  };

  const handleSaveIdealista = async () => {
    try {
      if (!idealistaKey && !idealistaConfigured) {
        toast({
          title: "Chave obrigatória",
          description: "Por favor, insira a chave RapidAPI.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const payload: any = {
        idealista_rapidapi_host: idealistaHost.trim() || "idealista2.p.rapidapi.com",
        idealista_rapidapi_list_endpoint: idealistaEndpoint.trim().startsWith('/') ? idealistaEndpoint.trim() : `/${idealistaEndpoint.trim()}`,
        idealista_auto_suggest_enabled: idealistaAutoSuggest ? "true" : "false",
        idealista_agency_filter: idealistaAgencyFilter.trim()
      };

      // Only include key if user typed a new one
      if (idealistaKey.trim()) {
        payload.idealista_rapidapi_key = idealistaKey.trim();
      }

      const res = await adminFetch("/api/admin/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Erro ao guardar");

      toast({
        title: "✅ Sucesso",
        description: "Configurações do Idealista guardadas de forma segura!",
      });

      setIdealistaKey(""); // Clear input
      await loadIdealistaSettings();
    } catch (error: any) {
      console.error("Error saving Idealista settings:", error);
      toast({ title: "Erro", description: "Falha ao guardar configurações.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadIntegrationSettings = async () => {
    try {
      setLoading(true);

      const res = await adminFetch("/api/admin/integrations");
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error("Integration settings load error:", errorData);
        throw new Error(errorData.error || "Falha ao carregar integrações");
      }
      
      const data = await res.json();

      // Process Google Calendar
      const gcData = data.find((i: any) => i.integration_name === "google_calendar");
      if (gcData) {
        const settings = gcData.settings || {};
        setGoogleCalendar({
          client_id: settings.client_id || "",
          client_secret: settings.client_secret || "",
          enabled: gcData.is_active || false
        });
        setIsGoogleConfigured(!!(settings.client_id && settings.client_secret));
      }

      // Process Notion
      const notionData = data.find((i: any) => i.integration_name === "notion");
      if (notionData) {
        const settings = notionData.settings || {};
        setNotion({
          client_id: settings.client_id || "",
          client_secret: settings.client_secret || "",
          enabled: notionData.is_active || false
        });
        setIsNotionConfigured(!!(settings.client_id && settings.client_secret));
      }

      // Process WhatsApp
      const waData = data.find((i: any) => i.integration_name === "whatsapp_api");
      if (waData) {
        const settings = waData.settings || {};
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
        title: "Erro ao carregar integrações",
        description: error.message || "Falha ao carregar configurações de integrações.",
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

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "google_calendar",
          settings: {
            client_id: googleCalendar.client_id.trim(),
            client_secret: googleCalendar.client_secret.trim(),
            redirect_uri: `${window.location.origin}/api/google-calendar/callback`.trim(),
            scopes: ["https://www.googleapis.com/auth/calendar"]
          },
          is_active: googleCalendar.enabled
        })
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      setIsGoogleConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações do Google Calendar salvas de forma segura!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving Google Calendar settings:", error);
      toast({ title: "Erro", description: "Falha ao salvar configurações.", variant: "destructive" });
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

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "notion",
          settings: {
            client_id: notion.client_id.trim(),
            client_secret: notion.client_secret.trim(),
            redirect_uri: `${window.location.origin}/api/notion/callback`.trim()
          },
          is_active: notion.enabled
        })
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      setIsNotionConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações do Notion salvas de forma segura!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving Notion settings:", error);
      toast({ title: "Erro", description: "Falha ao salvar configurações do Notion.", variant: "destructive" });
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

      setSaving(true);

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "whatsapp_api",
          settings: {
            access_token: whatsapp.access_token.trim(),
            business_account_id: whatsapp.business_account_id.trim(),
            verify_token: whatsapp.verify_token.trim(),
            phone_number_id: whatsapp.phone_number_id.trim(),
            template_name: whatsapp.template_name.trim()
          },
          is_active: whatsapp.enabled
        })
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      setIsWhatsappConfigured(true);
      toast({
        title: "✅ Sucesso",
        description: "Configurações Globais do WhatsApp salvas de forma segura!",
      });

      await loadIntegrationSettings();
    } catch (error: any) {
      console.error("Error saving WhatsApp settings:", error);
      toast({ title: "Erro", description: "Falha ao salvar configurações do WhatsApp.", variant: "destructive" });
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
      if (!isGoogleConfigured && enabled) return;

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "google_calendar",
          settings: googleCalendar,
          is_active: enabled
        })
      });

      if (!res.ok) throw new Error("Falha ao atualizar");
      
      setGoogleCalendar(prev => ({ ...prev, enabled }));
      toast({ title: enabled ? "✅ Ativada" : "⚠️ Desativada" });
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const handleToggleNotionEnabled = async (enabled: boolean) => {
    try {
      if (!isNotionConfigured && enabled) return;

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "notion",
          settings: notion,
          is_active: enabled
        })
      });

      if (!res.ok) throw new Error("Falha ao atualizar");

      setNotion(prev => ({ ...prev, enabled }));
      toast({ title: enabled ? "✅ Notion Ativado" : "⚠️ Notion Desativado" });
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const handleToggleWhatsappEnabled = async (enabled: boolean) => {
    try {
      if (!isWhatsappConfigured && enabled) return;

      const res = await adminFetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_name: "whatsapp_api",
          settings: whatsapp,
          is_active: enabled
        })
      });

      if (!res.ok) throw new Error("Falha ao atualizar");

      setWhatsapp(prev => ({ ...prev, enabled }));
      toast({ title: enabled ? "✅ WhatsApp Ativado" : "⚠️ WhatsApp Desativado" });
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const handleClearGoogleConfig = async () => {
    if (!confirm("Tem certeza que deseja limpar as configurações do Google?")) return;
    try {
      const res = await adminFetch("/api/admin/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_name: "google_calendar" })
      });
      if (!res.ok) throw new Error("Falha");
      
      setGoogleCalendar({ client_id: "", client_secret: "", enabled: false });
      setIsGoogleConfigured(false);
      toast({ title: "✅ Configuração Limpa" });
    } catch (error) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const handleClearNotionConfig = async () => {
    if (!confirm("Tem certeza que deseja limpar as configurações do Notion?")) return;
    try {
      const res = await adminFetch("/api/admin/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_name: "notion" })
      });
      if (!res.ok) throw new Error("Falha");
      
      setNotion({ client_id: "", client_secret: "", enabled: false });
      setIsNotionConfigured(false);
      toast({ title: "✅ Configuração Limpa" });
    } catch (error) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const generateVerifyToken = () => {
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setWhatsapp(prev => ({ ...prev, verify_token: newToken }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando configurações de forma segura...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">Configurações de Integrações</h1>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <ShieldCheck className="h-3 w-3 mr-1" />
              API Segura
            </Badge>
          </div>
          <p className="text-muted-foreground">
            As suas chaves privadas estão encriptadas e ocultas para máxima segurança.
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
                Configure as credenciais do Google Cloud Console.
              </CardDescription>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Importante: URL de Callback</p>
                  <code className="block bg-muted p-2 rounded text-sm">
                    {typeof window !== 'undefined' && `${window.location.origin}/api/google-calendar/callback`}
                  </code>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input
                    type="text"
                    value={googleCalendar.client_id}
                    onChange={(e) => setGoogleCalendar(prev => ({ ...prev, client_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={googleCalendar.client_secret}
                    onChange={(e) => setGoogleCalendar(prev => ({ ...prev, client_secret: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Oculto por segurança. Insira um novo valor para substituir o atual.</p>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Ativar Integração</Label>
                  <Switch checked={googleCalendar.enabled} onCheckedChange={handleToggleGoogleEnabled} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveGoogleCalendar} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>

                {isGoogleConfigured && (
                  <>
                    <Button variant="secondary" onClick={handleTestGoogleCalendar} disabled={isTesting}>
                      <Activity className="mr-2 h-4 w-4" /> Testar Ligação
                    </Button>
                    <Button variant="destructive" onClick={handleClearGoogleConfig}>Limpar</Button>
                  </>
                )}
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
                  <CheckCircle2 className="h-4 w-4" /> Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>System User Access Token</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={whatsapp.access_token}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, access_token: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID</Label>
                  <Input
                    value={whatsapp.business_account_id}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, business_account_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input
                    value={whatsapp.phone_number_id}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, phone_number_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Verify Token</Label>
                  <div className="flex gap-2">
                    <Input value={whatsapp.verify_token} onChange={(e) => setWhatsapp(prev => ({ ...prev, verify_token: e.target.value }))} />
                    <Button variant="outline" onClick={generateVerifyToken}>Gerar</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Template Automático</Label>
                  <Input value={whatsapp.template_name} onChange={(e) => setWhatsapp(prev => ({ ...prev, template_name: e.target.value }))} />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Ativar Integração Global</Label>
                  <Switch checked={whatsapp.enabled} onCheckedChange={handleToggleWhatsappEnabled} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveWhatsapp} disabled={saving}>Salvar Configurações</Button>
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
                  <CheckCircle2 className="h-4 w-4" /> Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>OAuth Client ID</Label>
                  <Input value={notion.client_id} onChange={(e) => setNotion(prev => ({ ...prev, client_id: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>OAuth Client Secret</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={notion.client_secret}
                    onChange={(e) => setNotion(prev => ({ ...prev, client_secret: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Ativar Integração</Label>
                  <Switch checked={notion.enabled} onCheckedChange={handleToggleNotionEnabled} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveNotion} disabled={saving}>Salvar Configurações</Button>
                {isNotionConfigured && (
                  <Button variant="destructive" onClick={handleClearNotionConfig}>Limpar</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div id="external-portals">
            <ExternalPortalsSettings />
          </div>

          {/* Idealista Global API */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Idealista (RapidAPI)</CardTitle>
              </div>
              {idealistaConfigured && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Configurado
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <CardDescription>
                Configure a chave global da API do Idealista. Esta configuração aplica-se a todos os utilizadores da instância.
              </CardDescription>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">Configuração Global</p>
                  <p className="text-sm">A chave é partilhada por toda a equipa. Obtenha-a em{" "}
                    <a
                      href="https://rapidapi.com/apidojo/api/idealista2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      RapidAPI <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Chave da API (RapidAPI)</Label>
                  <Input
                    type="password"
                    placeholder={idealistaConfigured ? "••••••••" : "Insira a chave RapidAPI"}
                    value={idealistaKey}
                    onChange={(e) => setIdealistaKey(e.target.value)}
                  />
                  {idealistaConfigured && idealistaMaskedKey && (
                    <p className="text-xs text-muted-foreground">
                      Chave atual: {idealistaMaskedKey}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Host da API</Label>
                  <Input
                    value={idealistaHost}
                    onChange={(e) => setIdealistaHost(e.target.value)}
                    placeholder="idealista2.p.rapidapi.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endpoint de Listagem</Label>
                  <Input
                    value={idealistaEndpoint}
                    onChange={(e) => setIdealistaEndpoint(e.target.value)}
                    placeholder="/properties/list"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sugestões Automáticas</Label>
                    <p className="text-xs text-muted-foreground">
                      Pesquisa automática de imóveis para novas leads
                    </p>
                  </div>
                  <Switch
                    checked={idealistaAutoSuggest}
                    onCheckedChange={(checked) => setIdealistaAutoSuggest(checked)}
                  />
                </div>

                {idealistaAutoSuggest && (
                  <div className="space-y-2 pl-4 border-l-2">
                    <Label>Filtro de Agência (Opcional)</Label>
                    <Input
                      value={idealistaAgencyFilter}
                      onChange={(e) => setIdealistaAgencyFilter(e.target.value)}
                      placeholder="Ex: Remax, Century 21..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Filtrar sugestões apenas desta imobiliária
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveIdealista} disabled={saving}>
                  {saving ? "A guardar..." : "Guardar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <MetaAppSettings />
        </div>
      </div>
    </Layout>
  );
}