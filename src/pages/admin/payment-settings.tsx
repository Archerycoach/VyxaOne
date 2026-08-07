import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Save, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface PaymentConfig {
  stripe_enabled: boolean;
  stripe_public_key: string;
  stripe_secret_key: string;
  ifthenpay_enabled: boolean;
  ifthenpay_mbway_key: string;
  ifthenpay_mb_key: string;
  ifthenpay_creditcard_key: string;
  ifthenpay_antiphishing_key: string;
  mbway_enabled: boolean;
  test_mode: boolean;
}

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    stripe_secret: false,
    ifthenpay_mbway: false,
    ifthenpay_mb: false,
    ifthenpay_creditcard: false,
    ifthenpay_antiphishing: false,
  });
  const [config, setConfig] = useState<PaymentConfig>({
    stripe_enabled: false,
    stripe_public_key: "",
    stripe_secret_key: "",
    ifthenpay_enabled: false,
    ifthenpay_mbway_key: "",
    ifthenpay_mb_key: "",
    ifthenpay_creditcard_key: "",
    ifthenpay_antiphishing_key: "",
    mbway_enabled: false,
    test_mode: true,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch seguro via API (sem LocalStorage)
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

  // Teste seguro da ifthenpay: gera uma referência Multibanco (não cobra nada).
  const testIfthenpay = async () => {
    setIsTesting(true);
    setSaveMessage(null);
    try {
      const res = await adminFetch("/api/ifthenpay/test-connection", { method: "POST" });
      const body = await res.json();
      if (body.ok) {
        setSaveMessage({
          type: "success",
          text: `${body.message}${body.entity ? ` (entidade ${body.entity}, ref ${body.reference})` : ""}.`,
        });
      } else {
        setSaveMessage({
          type: "error",
          text: `Falha: ${body.error}`,
        });
      }
    } catch (error: any) {
      setSaveMessage({ type: "error", text: error.message || "Erro ao testar a ligação." });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    loadConfig();
  };

  const loadConfig = async () => {
    try {
      const res = await adminFetch("/api/admin/payment-settings");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);

      if (config.stripe_enabled && (!config.stripe_public_key || !config.stripe_secret_key)) {
        setSaveMessage({ type: "error", text: "Por favor, preencha as chaves do Stripe" });
        return;
      }

      if (config.ifthenpay_enabled && !config.ifthenpay_mbway_key && !config.ifthenpay_mb_key && !config.ifthenpay_creditcard_key) {
        setSaveMessage({ type: "error", text: "Preencha pelo menos uma chave da ifthenpay (MB WAY, Multibanco ou Cartão)" });
        return;
      }

      // Guardar através da API em vez de LocalStorage
      const res = await adminFetch("/api/admin/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      });

      if (!res.ok) throw new Error("Erro ao guardar na API");

      setSaveMessage({ type: "success", text: "Configurações guardadas com segurança!" });
      
      setTimeout(() => setSaveMessage(null), 3000);
      
      // Recarregar para garantir que as chaves censuradas são apresentadas
      await loadConfig();
    } catch (error: any) {
      console.error("Error saving config:", error);
      setSaveMessage({ type: "error", text: error.message || "Erro ao guardar configurações" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (field: keyof PaymentConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">A carregar configurações de pagamento (Cofre Seguro)...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-bold text-gray-900">Configurações de Pagamento</h1>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-2">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  API Segura
                </Badge>
              </div>
              <p className="text-gray-600 mt-1">Nenhuma chave secreta é armazenada localmente. Total isolamento.</p>
            </div>
          </div>

          {saveMessage && (
            <Alert className={`${saveMessage.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              {saveMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={saveMessage.type === "success" ? "text-green-800" : "text-red-800"}>
                {saveMessage.text}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="stripe" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stripe">
                <CreditCard className="h-4 w-4 mr-2" /> Stripe
              </TabsTrigger>
              <TabsTrigger value="ifthenpay">
                <Smartphone className="h-4 w-4 mr-2" /> ifthenpay / MB WAY
              </TabsTrigger>
              <TabsTrigger value="general">Geral</TabsTrigger>
            </TabsList>

            <TabsContent value="stripe">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Stripe
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Aceite pagamentos com cartão internacionalmente
                      </CardDescription>
                    </div>
                    <Switch
                      checked={config.stripe_enabled}
                      onCheckedChange={(checked) => updateConfig("stripe_enabled", checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="stripe_public_key">Publishable Key (pk_...)</Label>
                      <Input
                        id="stripe_public_key"
                        type="text"
                        value={config.stripe_public_key}
                        onChange={(e) => updateConfig("stripe_public_key", e.target.value)}
                        disabled={!config.stripe_enabled}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="stripe_secret_key">Secret Key (sk_...)</Label>
                      <div className="relative mt-2">
                        <Input
                          id="stripe_secret_key"
                          type={showSecrets.stripe_secret ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={config.stripe_secret_key}
                          onChange={(e) => updateConfig("stripe_secret_key", e.target.value)}
                          disabled={!config.stripe_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, stripe_secret: !prev.stripe_secret }))}
                        >
                          {showSecrets.stripe_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">A sua chave está encriptada na base de dados. Introduza um novo valor para a substituir.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ifthenpay">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5" /> ifthenpay
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Aceite pagamentos via MB WAY, Multibanco e Cartão
                      </CardDescription>
                    </div>
                    <Switch
                      checked={config.ifthenpay_enabled}
                      onCheckedChange={(checked) => updateConfig("ifthenpay_enabled", checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-sm">
                      A ifthenpay tem <strong>uma chave por método</strong> (contrato à parte para cada um) e{" "}
                      <strong>não tem ambiente de sandbox</strong> — o mesmo URL serve testes e produção. Antes de
                      teres chaves próprias, testa com as chaves de demonstração públicas da ifthenpay. Depois de
                      guardar, regista em <em>cada</em> chave, no backoffice da ifthenpay, o URL de callback:{" "}
                      <code className="bg-amber-100 px-1 rounded text-xs">https://www.vyxa.pt/api/ifthenpay/webhook</code>
                      {" "}(troca pelo domínio desta instância).
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ifthenpay_mbway_key">Chave MB WAY (MbWayKey)</Label>
                      <div className="relative mt-2">
                        <Input
                          id="ifthenpay_mbway_key"
                          type={showSecrets.ifthenpay_mbway ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={config.ifthenpay_mbway_key}
                          onChange={(e) => updateConfig("ifthenpay_mbway_key", e.target.value)}
                          disabled={!config.ifthenpay_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, ifthenpay_mbway: !prev.ifthenpay_mbway }))}
                        >
                          {showSecrets.ifthenpay_mbway ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ifthenpay_mb_key">Chave Multibanco (MB Key)</Label>
                      <div className="relative mt-2">
                        <Input
                          id="ifthenpay_mb_key"
                          type={showSecrets.ifthenpay_mb ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={config.ifthenpay_mb_key}
                          onChange={(e) => updateConfig("ifthenpay_mb_key", e.target.value)}
                          disabled={!config.ifthenpay_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, ifthenpay_mb: !prev.ifthenpay_mb }))}
                        >
                          {showSecrets.ifthenpay_mb ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ifthenpay_creditcard_key">Chave Cartão de Crédito (CCard Key)</Label>
                      <div className="relative mt-2">
                        <Input
                          id="ifthenpay_creditcard_key"
                          type={showSecrets.ifthenpay_creditcard ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={config.ifthenpay_creditcard_key}
                          onChange={(e) => updateConfig("ifthenpay_creditcard_key", e.target.value)}
                          disabled={!config.ifthenpay_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, ifthenpay_creditcard: !prev.ifthenpay_creditcard }))}
                        >
                          {showSecrets.ifthenpay_creditcard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ifthenpay_antiphishing_key">Chave anti-phishing</Label>
                      <div className="relative mt-2">
                        <Input
                          id="ifthenpay_antiphishing_key"
                          type={showSecrets.ifthenpay_antiphishing ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={config.ifthenpay_antiphishing_key}
                          onChange={(e) => updateConfig("ifthenpay_antiphishing_key", e.target.value)}
                          disabled={!config.ifthenpay_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, ifthenpay_antiphishing: !prev.ifthenpay_antiphishing }))}
                        >
                          {showSecrets.ifthenpay_antiphishing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define-a tu (10-50 carateres) e usa a mesma ao ativar o callback no backoffice da ifthenpay —
                        é o que confirma que uma chamada ao webhook vem mesmo de lá.
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      <div>
                        <Label htmlFor="mbway_enabled" className="text-base font-semibold">Ativar MB WAY</Label>
                      </div>
                      <Switch
                        id="mbway_enabled"
                        checked={config.mbway_enabled}
                        onCheckedChange={(checked) => updateConfig("mbway_enabled", checked)}
                        disabled={!config.ifthenpay_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <Label className="text-base font-semibold">Testar ligação</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Gera uma referência Multibanco de teste — confirma que a chave autentica.
                          Não cobra nada (guarde a config primeiro).
                        </p>
                      </div>
                      <Button variant="outline" onClick={testIfthenpay} disabled={isTesting || !config.ifthenpay_enabled}>
                        {isTesting ? "A testar..." : "Testar ligação"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div>
                      <Label htmlFor="test_mode" className="text-base font-semibold">Modo de Teste</Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Aplica-se ao Stripe (troca de chaves pk_test/sk_test). A ifthenpay não tem sandbox — testa-se
                        com as chaves de demonstração dela ou com as tuas próprias, no mesmo URL de produção.
                      </p>
                    </div>
                    <Switch
                      id="test_mode"
                      checked={config.test_mode}
                      onCheckedChange={(checked) => updateConfig("test_mode", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "A Guardar..." : "Guardar Segurança"}
            </Button>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}