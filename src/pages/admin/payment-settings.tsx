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
import { CreditCard, Smartphone, Save, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface PaymentConfig {
  stripe_enabled: boolean;
  stripe_public_key: string;
  stripe_secret_key: string;
  eupago_enabled: boolean;
  eupago_api_key: string;
  mbway_enabled: boolean;
  test_mode: boolean;
}

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    stripe_secret: false,
    eupago_key: false,
  });
  const [config, setConfig] = useState<PaymentConfig>({
    stripe_enabled: false,
    stripe_public_key: "",
    stripe_secret_key: "",
    eupago_enabled: false,
    eupago_api_key: "",
    mbway_enabled: false,
    test_mode: true,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      const savedConfig = localStorage.getItem("payment_config");
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
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

      if (config.eupago_enabled && !config.eupago_api_key) {
        setSaveMessage({ type: "error", text: "Por favor, preencha a chave da API Eupago" });
        return;
      }

      localStorage.setItem("payment_config", JSON.stringify(config));

      setSaveMessage({ type: "success", text: "Configurações guardadas com sucesso!" });
      
      setTimeout(() => setSaveMessage(null), 3000);
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
              <p className="text-gray-600">A carregar configurações...</p>
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
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Configurações de Pagamento</h1>
              <p className="text-gray-600">Configure os métodos de pagamento disponíveis para subscrições</p>
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
                <CreditCard className="h-4 w-4 mr-2" />
                Stripe
              </TabsTrigger>
              <TabsTrigger value="eupago">
                <Smartphone className="h-4 w-4 mr-2" />
                Eupago / MBWay
              </TabsTrigger>
              <TabsTrigger value="general">Geral</TabsTrigger>
            </TabsList>

            <TabsContent value="stripe">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Stripe
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Aceite pagamentos com cartão de crédito/débito internacionalmente
                      </CardDescription>
                    </div>
                    <Switch
                      checked={config.stripe_enabled}
                      onCheckedChange={(checked) => updateConfig("stripe_enabled", checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como Configurar o Stripe</h4>
                    <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
                      <li>Acesse <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">stripe.com</a> e crie uma conta</li>
                      <li>Vá para <strong>Developers → API Keys</strong></li>
                      <li>Copie a <strong>Publishable key</strong> e <strong>Secret key</strong></li>
                      <li>Cole as chaves abaixo</li>
                      <li>Ative o modo de teste para desenvolvimento</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="stripe_public_key">Publishable Key (pk_...)</Label>
                      <Input
                        id="stripe_public_key"
                        type="text"
                        placeholder="pk_live_... ou pk_test_..."
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
                          placeholder="sk_live_... ou sk_test_..."
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
                          {showSecrets.stripe_secret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>⚠️ Segurança:</strong> Nunca partilhe suas chaves secretas. Use variáveis de ambiente em produção.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="eupago">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        Eupago / MBWay
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Aceite pagamentos via MBWay, Multibanco e Cartões (Portugal)
                      </CardDescription>
                    </div>
                    <Switch
                      checked={config.eupago_enabled}
                      onCheckedChange={(checked) => updateConfig("eupago_enabled", checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-2">ℹ️ Como Configurar o Eupago</h4>
                    <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
                      <li>Acesse <a href="https://eupago.pt" target="_blank" rel="noopener noreferrer" className="underline font-medium">eupago.pt</a> e crie uma conta</li>
                      <li>Complete o processo de verificação</li>
                      <li>Vá para <strong>API → Chaves de API</strong></li>
                      <li>Gere uma nova chave de API</li>
                      <li>Cole a chave abaixo</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="eupago_api_key">Chave de API Eupago</Label>
                      <div className="relative mt-2">
                        <Input
                          id="eupago_api_key"
                          type={showSecrets.eupago_key ? "text" : "password"}
                          placeholder="eupago_..."
                          value={config.eupago_api_key}
                          onChange={(e) => updateConfig("eupago_api_key", e.target.value)}
                          disabled={!config.eupago_enabled}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSecrets(prev => ({ ...prev, eupago_key: !prev.eupago_key }))}
                        >
                          {showSecrets.eupago_key ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      <div>
                        <Label htmlFor="mbway_enabled" className="text-base font-semibold">
                          Ativar MBWay
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Permitir pagamentos via MBWay
                        </p>
                      </div>
                      <Switch
                        id="mbway_enabled"
                        checked={config.mbway_enabled}
                        onCheckedChange={(checked) => updateConfig("mbway_enabled", checked)}
                        disabled={!config.eupago_enabled}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border-2 rounded-lg p-4">
                      <h5 className="font-semibold mb-2">Métodos Disponíveis:</h5>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          MBWay
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Multibanco
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Cartões VISA/Mastercard
                        </li>
                      </ul>
                    </div>
                    <div className="bg-white border-2 rounded-lg p-4">
                      <h5 className="font-semibold mb-2">Comissões Eupago:</h5>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>MBWay: A partir de 1%</li>
                        <li>Multibanco: A partir de 0.5%</li>
                        <li>Cartões: A partir de 1.5%</li>
                        <li className="text-xs text-gray-500 mt-2">* Valores indicativos, confirme com Eupago</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>
                    Configurações globais de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div>
                      <Label htmlFor="test_mode" className="text-base font-semibold">
                        Modo de Teste
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Ativar para usar chaves de teste (desenvolvimento)
                      </p>
                    </div>
                    <Switch
                      id="test_mode"
                      checked={config.test_mode}
                      onCheckedChange={(checked) => updateConfig("test_mode", checked)}
                    />
                  </div>

                  {config.test_mode && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <strong>Modo de Teste Ativo:</strong> Nenhum pagamento real será processado. Use cartões de teste.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">📊 Status dos Métodos de Pagamento</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Stripe (Cartões Internacionais)</span>
                        {config.stripe_enabled ? (
                          <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Eupago (Portugal)</span>
                        {config.eupago_enabled ? (
                          <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium ml-4">↳ MBWay</span>
                        {config.mbway_enabled && config.eupago_enabled ? (
                          <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2">💡 Recomendações</h4>
                    <ul className="text-sm text-purple-800 space-y-2 ml-4 list-disc">
                      <li><strong>Para mercado português:</strong> Ative Eupago + MBWay (essencial)</li>
                      <li><strong>Para mercado internacional:</strong> Ative Stripe</li>
                      <li><strong>Ideal:</strong> Ative ambos para máxima conversão</li>
                      <li><strong>Desenvolvimento:</strong> Use sempre o modo de teste</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "A Guardar..." : "Guardar Configurações"}
            </Button>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}