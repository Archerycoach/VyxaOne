import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, User, Lock, Building2, Bell, Save, Loader2, Mail, Facebook, Calendar, Bot, Activity, Zap, FileText, Globe, Sparkles, CheckCircle2, XCircle, MessageCircle, Trash2 } from "lucide-react";
import { getUserProfile, updateUserProfile } from "@/services/profileService";
import { updatePassword, getSession, signOut } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SMTPSettingsDialog } from "@/components/SMTPSettingsDialog";
import { MetaAccountConnection } from "@/components/settings/MetaAccountConnection";
import { MetaFormsManagement } from "@/components/settings/MetaFormsManagement";
import { GptApiSettings } from "@/components/settings/GptApiSettings";
import { WorkflowsManagement } from "@/components/settings/WorkflowsManagement";
import { NotionAccountConnection } from "@/components/settings/NotionAccountConnection";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function buildGoogleScopeString(scopes: unknown) {
  const configuredScopes = Array.isArray(scopes)
    ? scopes.filter((scope): scope is string => typeof scope === "string" && scope.trim().length > 0)
    : typeof scopes === "string"
      ? scopes.split(/\s+/).filter(Boolean)
      : [];

  return Array.from(new Set([...configuredScopes, ...REQUIRED_GOOGLE_SCOPES])).join(" ");
}

export default function Settings() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingReactivationToggle, setSavingReactivationToggle] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  });
  
  // Daily Digest Settings
  const [digestSettings, setDigestSettings] = useState<any>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);
  
  // Auth check
  const [authChecking, setAuthChecking] = useState(true);
  
  // Profile form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  
  // SMTP Dialog
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  
  // Meta Integration
  const [selectedMetaIntegration, setSelectedMetaIntegration] = useState<{id: string; name: string} | null>(null);

  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isTestingGoogle, setIsTestingGoogle] = useState(false);

  useEffect(() => {
    checkAuth();
    loadDigestSettings();
  }, []);

  const loadDigestSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("daily_digest_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading digest settings:", error);
        return;
      }

      if (data) {
        setDigestSettings(data);
      } else {
        // Create default settings
        const defaultSettings = {
          user_id: user.id,
          enabled: true,
          delivery_time: "08:00:00",
          send_notification: true,
          send_email: true,
          send_whatsapp: false,
          include_hot_leads: true,
          include_tasks: true,
          include_events: true,
          include_overdue_proposals: true
        };
        
        const { data: newSettings, error: insertError } = await supabase
          .from("daily_digest_settings" as any)
          .insert(defaultSettings)
          .select()
          .single();

        if (!insertError && newSettings) {
          setDigestSettings(newSettings);
        }
      }
    } catch (error) {
      console.error("Error in loadDigestSettings:", error);
    }
  };

  const handleSaveDigestSettings = async () => {
    if (!digestSettings) return;
    
    setLoadingDigest(true);
    try {
      const { error } = await supabase
        .from("daily_digest_settings" as any)
        .update(digestSettings)
        .eq("user_id", digestSettings.user_id);

      if (error) throw error;

      toast({
        title: "Configurações guardadas",
        description: "As suas preferências de resumo diário foram atualizadas.",
      });
    } catch (error) {
      console.error("Error saving digest settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar as configurações.",
        variant: "destructive",
      });
    } finally {
      setLoadingDigest(false);
    }
  };

  const checkGoogleStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("google_calendar_integrations" as any).select("id").eq("user_id", user.id).maybeSingle();
      setIsGoogleConnected(!!data);
    }
  };

  const handleTestGoogleConnection = async () => {
    try {
      setIsTestingGoogle(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch("/api/google-calendar/test-connection", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ type: "user" })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ Teste Bem Sucedido", description: data.message });
      } else {
        toast({ title: "❌ Falha no Teste", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao testar a ligação com a Google.", variant: "destructive" });
    } finally {
      setIsTestingGoogle(false);
    }
  };

  const checkAuth = async () => {
    try {
      setAuthChecking(true);
      const session = await getSession();
      
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        router.push("/login");
        return;
      }

      await loadProfile();
    } catch (error) {
      console.error("Authentication error:", error);
      
      try {
        await signOut();
      } catch (signOutError) {
        console.error("Error signing out:", signOutError);
      }
      
      toast({
        title: "Erro de autenticação",
        description: "Por favor, faça login novamente.",
        variant: "destructive",
      });
      router.push("/login");
    } finally {
      setAuthChecking(false);
    }
  };

  const loadProfile = async () => {
    try {
      const data = await getUserProfile();
      if (data) {
        console.log("[Settings] Profile loaded:", data);
        setProfile(data);
        setFullName(data.full_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setReplyEmail(data.reply_email || "");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      if (error?.message === "Not authenticated") {
        router.push("/login");
      }
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      await updateUserProfile({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        reply_email: profile.reply_email,
        email_daily_tasks: profile.email_daily_tasks,
        email_daily_events: profile.email_daily_events,
        email_new_lead_assigned: profile.email_new_lead_assigned,
        email_signature_text: profile.email_signature_text,
        email_signature_image_url: profile.email_signature_image_url,
      });
      
      toast({
        title: "Perfil atualizado",
        description: "As suas alterações foram guardadas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivationToggle = async (checked: boolean) => {
    if (!profile?.id) return;
    setSavingReactivationToggle(true);
    try {
      // NOTA: "reactivation_automation_enabled" só existe em profiles depois
      // de correr a migração supabase/migrations/20260701170000_*.sql e
      // regenerar database.types.ts. Até lá, o campo não existe no tipo
      // gerado, por isso usamos "as any" no nome da tabela aqui — o mesmo
      // padrão já usado no resto do código para tabelas/colunas recentes
      // (ex.: user_smtp_settings em smtpService.ts). Pode ser removido assim
      // que os tipos forem regenerados.
      const { error } = await (supabase
        .from("profiles" as any)
        .update({ reactivation_automation_enabled: checked })
        .eq("id", profile.id) as any);

      if (error) throw error;

      setProfile((prev: any) => prev ? { ...prev, reactivation_automation_enabled: checked } : prev);
      toast({
        title: checked ? "Automação ativada" : "Automação desativada",
        description: checked
          ? "A reativação automática de leads (email + WhatsApp) vai voltar a correr diariamente."
          : "A reativação automática de leads (email + WhatsApp) foi desligada.",
      });
    } catch (error) {
      console.error("Error updating reactivation automation toggle:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar esta definição.",
        variant: "destructive",
      });
    } finally {
      setSavingReactivationToggle(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As palavras-passe não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A palavra-passe deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await updatePassword(newPassword);
      
      toast({
        title: "Palavra-passe alterada",
        description: "A sua palavra-passe foi atualizada com sucesso.",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a palavra-passe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking authentication
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">A verificar autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Menu
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Definições
              </h1>
              <p className="text-slate-600">Gerir perfil e preferências</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex flex-wrap w-full justify-start h-auto gap-1 p-1">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building2 className="h-4 w-4 mr-2" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="smtp">
              <Mail className="h-4 w-4 mr-2" />
              SMTP
            </TabsTrigger>
            <TabsTrigger value="signature">
              <FileText className="h-4 w-4 mr-2" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="meta">
              <Facebook className="h-4 w-4 mr-2" />
              Meta
            </TabsTrigger>
            <TabsTrigger value="google-calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="gpt-agent">
              <Bot className="h-4 w-4 mr-2" />
              GPT Agent
            </TabsTrigger>
            <TabsTrigger value="workflows">
              <Zap className="h-4 w-4 mr-2" />
              Automação
            </TabsTrigger>
            <TabsTrigger value="send-automations">
              <Mail className="h-4 w-4 mr-2" />
              Envios Automáticos
            </TabsTrigger>
            <TabsTrigger value="portals">
              <Globe className="h-4 w-4 mr-2" />
              Portais
            </TabsTrigger>
            <TabsTrigger value="notion">
              <FileText className="h-4 w-4 mr-2" />
              Notion
            </TabsTrigger>
            <TabsTrigger value="daily-digest">
              <Bell className="h-4 w-4 mr-2" />
              Resumo Diário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Informação Pessoal</CardTitle>
                <CardDescription>Atualize os seus dados de perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input 
                    value={profile?.full_name || ""} 
                    onChange={e => setProfile(prev => prev ? {...prev, full_name: e.target.value} : null)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Email da Conta</Label>
                  <Input 
                    value={profile?.email || ""} 
                    disabled 
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-slate-500">
                    Este é o email usado para login. Não pode ser alterado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Email para Respostas</Label>
                  <Input 
                    type="email"
                    value={profile?.reply_email || ""} 
                    onChange={e => setProfile(prev => prev ? {...prev, reply_email: e.target.value} : null)}
                    placeholder="Ex: joao.silva@imobiliaria.pt"
                  />
                  <p className="text-xs text-slate-500">
                    📧 Quando enviar emails via Vyxa One, os clientes responderão para este endereço.
                    Se deixar vazio, será usado o email da conta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    value={profile?.phone || ""} 
                    onChange={e => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                    placeholder="Ex: +351 912 345 678"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Alerta de Resposta Rápida (minutos)</Label>
                  <Input 
                    type="number"
                    min="1"
                    max="1440"
                    value={profile?.first_contact_alert_minutes || 15} 
                    onChange={e => setProfile(prev => prev ? {...prev, first_contact_alert_minutes: parseInt(e.target.value) || 15} : null)}
                    placeholder="15"
                  />
                  <p className="text-xs text-slate-500">
                    🚨 Você será alertado (notificação + WhatsApp opcional) se uma lead nova não for contactada dentro deste tempo. Default: 15 minutos.
                  </p>
                </div>

                <Button onClick={updateProfile} disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "A guardar..." : "Guardar Alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Palavra-passe</CardTitle>
                <CardDescription>
                  Escolha uma palavra-passe forte para proteger a sua conta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <Label htmlFor="newPassword">Nova Palavra-passe</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Palavra-passe</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite novamente"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          A alterar...
                        </>
                      ) : (
                        "Alterar Palavra-passe"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Empresa</CardTitle>
                <CardDescription>Informações sobre a sua empresa</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={updateProfile} className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Imobiliária XYZ"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          A guardar...
                        </>
                      ) : (
                        "Guardar Alterações"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="smtp">
            <Card>
              <CardHeader>
                <CardTitle>Configuração SMTP</CardTitle>
                <CardDescription>
                  Configure o seu servidor SMTP para enviar emails diretamente da aplicação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-4 rounded-lg border p-4">
                  <Mail className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Servidor SMTP Personalizado
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Configure o seu próprio servidor SMTP para enviar emails através da aplicação.
                      Suporta Gmail, Outlook, SMTP personalizado e outros provedores.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setSmtpDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Configurar SMTP
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signature">
            <Card>
              <CardHeader>
                <CardTitle>Assinatura de Email</CardTitle>
                <CardDescription>
                  Configure a assinatura que aparecerá automaticamente em todos os seus emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Editor de Assinatura</Label>
                    <div className="border rounded-md overflow-hidden">
                      <RichTextEditor
                        value={profile?.email_signature_text || ""}
                        onChange={val => setProfile(prev => prev ? {...prev, email_signature_text: val} : null)}
                        placeholder={`Melhores cumprimentos,\nO seu Nome...`}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Esta assinatura será adicionada no final de todos os emails que enviar através da plataforma. Pode escrever, formatar e fazer o upload de imagens diretamente na caixa acima (limite de 1MB por imagem).
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg bg-blue-50">
                    <p className="text-sm font-medium mb-2">Pré-visualização Completa:</p>
                    <div className="bg-white p-4 rounded border">
                      <div 
                        className="text-sm prose prose-sm max-w-none" 
                        dangerouslySetInnerHTML={{ __html: profile?.email_signature_text || "Sua assinatura aparecerá aqui..." }} 
                      />
                      {/* Mantemos compatibilidade com imagens antigas se existirem */}
                      {profile?.email_signature_image_url && (
                        <img 
                          src={profile.email_signature_image_url} 
                          alt="Assinatura legada" 
                          className="mt-2 max-w-full h-auto max-h-32"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={updateProfile} disabled={loading} className="bg-gradient-to-r from-blue-600 to-purple-600">
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? "A guardar..." : "Guardar Assinatura"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setProfile((prev: any) => prev ? {...prev, email_signature_text: "", email_signature_image_url: null} : null)} 
                      disabled={loading}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Apagar Assinatura
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Escolha como você deseja receber atualizações.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-gray-500">
                      Receba atualizações sobre suas leads e tarefas.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações Push</Label>
                    <p className="text-sm text-gray-500">
                      Receba alertas em tempo real no navegador.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, push: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Facebook className="h-6 w-6 text-blue-600" />
                    Meta Lead Ads
                  </div>
                </CardTitle>
                <CardDescription>
                  Conecte suas páginas do Facebook e Instagram para receber leads automaticamente no CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <MetaAccountConnection onSelectIntegration={(integration) => setSelectedMetaIntegration(integration)} />
                
                {selectedMetaIntegration && (
                  <div className="mt-6 pt-6 border-t">
                    <MetaFormsManagement 
                      integrationId={selectedMetaIntegration.id}
                      integrationName={selectedMetaIntegration.name}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="google-calendar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    Google Calendar
                  </div>
                </CardTitle>
                <CardDescription>
                  Conecte sua conta Google para sincronizar eventos e compromissos automaticamente com o CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start space-x-4 rounded-lg border p-4">
                  <Calendar className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Sincronização Bidirecional
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sincronize eventos do Google Calendar com o Vyxa One e vice-versa. Eventos criados no CRM aparecem no Google Calendar automaticamente.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Status da Conexão</p>
                      <p className="text-xs text-muted-foreground">
                        Verifique se sua conta Google está conectada
                      </p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          console.log("[Google Auth] Botão clicado");
                          toast({
                            title: "A iniciar ligação...",
                            description: "Aguarde enquanto preparamos o ambiente seguro da Google.",
                          });

                          // Obter configuração através da API segura em vez de ler diretamente da tabela
                          console.log("[Google Auth] A pedir configurações à API...");
                          const response = await fetch('/api/google-calendar/settings');
                          
                          if (!response.ok) {
                            console.error("[Google Auth] Erro da API:", response.status, response.statusText);
                            throw new Error(`Falha ao obter configurações: ${response.statusText}`);
                          }
                          
                          const settings = await response.json();
                          console.log("[Google Auth] Configurações obtidas:", { hasClientId: !!settings.clientId });

                          // Check if user has an active connection in google_calendar_integrations table
                          const { data: user, error: authError } = await supabase.auth.getUser();
                          
                          if (authError || !user?.user) {
                            console.error("[Google Auth] Erro de sessão:", authError);
                            toast({
                              title: "Erro de autenticação",
                              description: "Por favor, faça login novamente.",
                              variant: "destructive",
                            });
                            return;
                          }

                          console.log("[Google Auth] Utilizador verificado:", user.user.id);

                          // Use type assertion to bypass TypeScript error with google_calendar_integrations
                          const { data: userIntegration, error: dbError } = await supabase
                            .from("google_calendar_integrations" as any)
                            .select("id")
                            .eq("user_id", user.user.id)
                            .maybeSingle();

                          if (dbError) {
                            console.error("[Google Auth] Erro ao verificar integração existente:", dbError);
                            // Continuar mesmo com erro, para permitir a ligação
                          }

                          if (userIntegration) {
                            console.log("[Google Auth] Conta já conectada.");
                            toast({
                              title: "Google Calendar Conectado",
                              description: "Sua conta já está conectada e sincronizando.",
                            });
                          } else {
                            console.log("[Google Auth] A preparar URL de redirecionamento...");
                            // If credentials exist but user not connected, start OAuth flow
                            if (settings && settings.clientId) {
                              const scopes = buildGoogleScopeString(settings.scopes);
                              
                              const redirectUri = window.location.origin.includes('localhost') || window.location.origin.includes('softgen') 
                                ? `${window.location.origin}/api/google-calendar/callback`
                                : (settings.redirectUri || `${window.location.origin}/api/google-calendar/callback`);
                              
                              // Codificar o estado para enviar o ID e o URL de redirecionamento de forma segura
                              const stateObj = {
                                userId: user.user.id,
                                redirectUri: redirectUri
                              };
                              const encodedState = window.btoa(JSON.stringify(stateObj));

                              const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
                              authUrl.searchParams.set("client_id", settings.clientId);
                              authUrl.searchParams.set("redirect_uri", redirectUri);
                              authUrl.searchParams.set("response_type", "code");
                              authUrl.searchParams.set("scope", scopes);
                              authUrl.searchParams.set("access_type", "offline");
                              authUrl.searchParams.set("prompt", "consent");
                              authUrl.searchParams.set("state", encodedState);
                              
                              console.log("[Google Auth] Redirecionando para:", authUrl.toString());
                              window.location.assign(authUrl.toString());
                            } else {
                              console.error("[Google Auth] ClientID não encontrado nas configurações");
                              toast({
                                title: "Configuração em falta",
                                description: "Contacte o administrador para configurar a integração Google Calendar.",
                                variant: "destructive"
                              });
                            }
                          }
                        } catch (error: any) {
                          console.error("[Google Auth] Erro geral capturado:", error);
                          toast({
                            title: "Erro inesperado",
                            description: `Não foi possível iniciar a ligação: ${error.message || "Erro desconhecido"}`,
                            variant: "destructive",
                          });
                        }
                      }}
                      className="bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Conectar Google Calendar
                    </Button>
                    
                    {isGoogleConnected && (
                      <Button
                        variant="outline"
                        onClick={handleTestGoogleConnection}
                        disabled={isTestingGoogle}
                        className="ml-3"
                      >
                        <Activity className="mr-2 h-4 w-4" />
                        {isTestingGoogle ? "A testar..." : "Testar Ligação"}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900">ℹ️ Como funciona:</h4>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Eventos criados no Vyxa One aparecem automaticamente no Google Calendar</li>
                      <li>Eventos do Google Calendar são importados para o CRM</li>
                      <li>Sincronização em tempo real via webhooks</li>
                      <li>Notificações e lembretes mantêm-se sincronizados</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gpt-agent" className="space-y-6">
            <GptApiSettings />
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <WorkflowsManagement />
            </div>
          </TabsContent>

          <TabsContent value="send-automations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reativação Automática de Leads</CardTitle>
                <CardDescription>
                  Todos os dias, a plataforma pode contactar automaticamente leads frias (sem
                  contacto há 30+ dias) até 3 vezes, por email ou WhatsApp, a pedir autorização
                  para continuar em contacto. Esta automação está desligada por defeito — só
                  corre depois de a ativar aqui.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="reactivation_automation_enabled" className="text-base font-medium">
                      Ativar reativação automática de leads
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quando desligado, nenhuma lead recebe emails ou mensagens de reativação automaticamente.
                    </p>
                  </div>
                  <Switch
                    id="reactivation_automation_enabled"
                    checked={Boolean(profile?.reactivation_automation_enabled)}
                    disabled={savingReactivationToggle}
                    onCheckedChange={handleReactivationToggle}
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  O envio automático de sugestões de imóveis a novas leads compradoras
                  (Property Matcher) tem o seu próprio interruptor no separador{" "}
                  <strong>GPT Agent</strong> — também desligado por defeito.
                </p>

                <p className="text-xs text-muted-foreground mt-2">
                  Pode consultar todos os emails automáticos já enviados (independentemente de
                  estarem ligados ou não) em{" "}
                  <a href="/automated-emails" className="text-blue-600 hover:underline">
                    Emails Automáticos
                  </a>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notion" className="space-y-6">
            <NotionAccountConnection />
          </TabsContent>
        </Tabs>

        <SMTPSettingsDialog 
          open={smtpDialogOpen} 
          onOpenChange={setSmtpDialogOpen}
        />
      </div>
    </div>
  );
}