import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Copy, Key, Plus, Trash2, Check, Clock, Loader2, CheckCircle2, XCircle, TrendingUp, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatCost } from "@/lib/ai/pricing";

interface GptApiKey {
  id: string;
  name?: string;
  api_key: string;
  provider: string;
  model: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  property_matcher_enabled?: boolean;
}

interface MonthlyUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
}

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o (Recomendado)" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini (Económico)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ]
  },
  anthropic: {
    name: "Anthropic (Claude)",
    models: [
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Recomendado)" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Económico)" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
      { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ]
  },
  google: {
    name: "Google Gemini",
    models: [
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Recomendado)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Económico)" },
      { value: "gemini-1.0-pro", label: "Gemini 1.0 Pro" },
    ]
  }
};

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('pt-PT', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
};

export function GptApiSettings() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<GptApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [propertyMatcherEnabled, setPropertyMatcherEnabled] = useState(false);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("gpt-4o-mini");
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    loadKeys();
    loadMonthlyUsage();
  }, []);

  useEffect(() => {
    // Reset model to first option when provider changes
    const firstModel = PROVIDERS[provider as keyof typeof PROVIDERS]?.models[0]?.value;
    if (firstModel) {
      setModel(firstModel);
    }
  }, [provider]);

  const loadMonthlyUsage = async () => {
    try {
      setLoadingUsage(true);
      
      // Get first day of current month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from("ai_usage_logs" as any)
        .select("input_tokens, output_tokens, estimated_cost")
        .gte("created_at", firstDayOfMonth);

      if (error) throw error;

      if (data && data.length > 0) {
        const usage = (data as any[]).reduce(
          (acc, log: any) => ({
            totalInputTokens: acc.totalInputTokens + (log.input_tokens || 0),
            totalOutputTokens: acc.totalOutputTokens + (log.output_tokens || 0),
            totalCost: acc.totalCost + parseFloat(log.estimated_cost || "0"),
            callCount: acc.callCount + 1,
          }),
          { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, callCount: 0 }
        );
        setMonthlyUsage(usage);
      } else {
        setMonthlyUsage({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, callCount: 0 });
      }
    } catch (error) {
      console.error("Error loading monthly usage:", error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from("gpt_api_keys" as any)
        .select("*")
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: GptApiKey[], error: any }>);

      if (error) throw error;
      setKeys(data || []);
      
      if (data && data.length > 0) {
        setPropertyMatcherEnabled(data[0].property_matcher_enabled || false);
      }
    } catch (error) {
      console.error("Error loading API keys:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as chaves de API.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira uma chave de API válida.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      // Make a minimal API call to test the connection
      let response;
      let success = false;
      let errorMessage = "";

      if (provider === "openai") {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Teste" }],
            max_tokens: 5,
          }),
        });
        success = response.ok;
        if (!success) {
          const error = await response.json();
          errorMessage = error.error?.message || "Erro desconhecido";
        }
      } else if (provider === "anthropic") {
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: "user", content: "Teste" }],
          }),
        });
        success = response.ok;
        if (!success) {
          const error = await response.json();
          errorMessage = error.error?.message || "Erro desconhecido";
        }
      } else if (provider === "google") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Teste" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });
        success = response.ok;
        if (!success) {
          const error = await response.json();
          errorMessage = error.error?.message || "Erro desconhecido";
        }
      }

      if (success) {
        setTestResult({ success: true, message: "Ligação bem-sucedida! A chave está válida." });
        toast({
          title: "Sucesso",
          description: "A chave de API foi validada com sucesso.",
        });
      } else {
        setTestResult({ success: false, message: `Falha na ligação: ${errorMessage}` });
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `Erro: ${error.message}` });
      toast({
        title: "Erro",
        description: "Não foi possível testar a ligação. Verifique a sua chave e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira uma chave de API válida.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilizador não autenticado");

      const { error } = await supabase
        .from("gpt_api_keys" as any)
        .insert({
          user_id: user.id,
          name: `${PROVIDERS[provider as keyof typeof PROVIDERS].name} - ${model}`,
          api_key: apiKey,
          provider,
          model,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Chave guardada",
        description: "A chave de API foi guardada com sucesso.",
      });

      // Reset form
      setShowForm(false);
      setApiKey("");
      setProvider("openai");
      setModel("gpt-4o-mini");
      setTestResult(null);

      await loadKeys();
    } catch (error) {
      console.error("Error saving API key:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar a chave.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePropertyMatcher = async (checked: boolean) => {
    try {
      setPropertyMatcherEnabled(checked);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("gpt_api_keys" as any)
        .update({ property_matcher_enabled: checked })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: checked ? "Resposta Automática Ativada" : "Resposta Automática Desativada",
        description: checked ? "O Agente irá responder automaticamente a novos compradores." : "O Agente não enviará emails automáticos.",
      });
    } catch (error) {
      console.error("Error toggling property matcher:", error);
      setPropertyMatcherEnabled(!checked);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a configuração.",
        variant: "destructive",
      });
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from("gpt_api_keys" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Chave revogada",
        description: "A chave de API foi eliminada permanentemente.",
      });

      setKeys(keys.filter(k => k.id !== id));
    } catch (error) {
      console.error("Error revoking API key:", error);
      toast({
        title: "Erro",
        description: "Não foi possível revogar a chave.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copiado",
      description: "Chave copiada para a área de transferência.",
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-indigo-600" />
              Configuração de Inteligência Artificial
            </div>
            <Button 
              onClick={() => setShowForm(!showForm)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {showForm ? "Cancelar" : "Adicionar Chave"}
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Configure o fornecedor de IA e o modelo que o CRM utiliza para gerar insights, qualificar leads e automatizar tarefas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monthly Usage Panel */}
        {monthlyUsage !== null && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-indigo-900">Consumo de IA este mês</h3>
            </div>
            
            {loadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <p className="text-xs font-medium text-gray-600">Chamadas</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{monthlyUsage.callCount}</p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <p className="text-xs font-medium text-gray-600">Tokens de Entrada</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(monthlyUsage.totalInputTokens)}</p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <p className="text-xs font-medium text-gray-600">Tokens de Saída</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(monthlyUsage.totalOutputTokens)}</p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs font-medium text-gray-600">Custo Estimado</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">{formatCost(monthlyUsage.totalCost)}</p>
                  <p className="text-xs text-gray-500 mt-1">USD (estimativa)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-indigo-900 mb-4">Adicionar Nova Chave de API</h3>
            
            <div className="space-y-2">
              <Label htmlFor="provider">Fornecedor de IA</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="google">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS[provider as keyof typeof PROVIDERS]?.models.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Chave de API</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={
                  provider === "openai" ? "sk-..." : 
                  provider === "anthropic" ? "sk-ant-..." : 
                  "AIza..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                {provider === "openai" && "Obtenha a sua chave em: https://platform.openai.com/api-keys"}
                {provider === "anthropic" && "Obtenha a sua chave em: https://console.anthropic.com/settings/keys"}
                {provider === "google" && "Obtenha a sua chave em: https://aistudio.google.com/app/apikey"}
              </p>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={testConnection}
                disabled={testing || !apiKey.trim()}
                variant="outline"
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A testar...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Testar Ligação
                  </>
                )}
              </Button>
              <Button
                onClick={saveKey}
                disabled={saving || !apiKey.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Guardar Chave
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white border rounded-lg p-4 mb-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Novo: Área do Agente IA</h4>
            <p className="text-sm text-gray-500 mt-1">A execução manual e a leitura de relatórios mudou de lugar.</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = "/ai-agent"}>
            Ir para Agente IA
          </Button>
        </div>

        <div className="bg-white border rounded-lg p-4 mb-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Resposta Automática a Compradores</h4>
            <p className="text-sm text-gray-500 mt-1">O Agente IA pesquisa nos Portais e responde automaticamente a novas leads de compradores com 3 sugestões de imóveis.</p>
          </div>
          <Switch 
            checked={propertyMatcherEnabled} 
            onCheckedChange={togglePropertyMatcher} 
            disabled={keys.length === 0}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Chaves Configuradas</h3>
          
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg bg-gray-50">
              <Bot className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Ainda não tem nenhuma chave configurada.</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Adicionar Chave" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{key.name || "Chave de API"}</span>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                        {PROVIDERS[key.provider as keyof typeof PROVIDERS]?.name || key.provider}
                      </span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-800">
                        {key.api_key.substring(0, 12)}...{key.api_key.substring(key.api_key.length - 4)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(key.id, key.api_key)}
                      >
                        {copiedId === key.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Modelo: {key.model}</span>
                      <span className="flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Criada a {formatDate(key.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {key.last_used_at ? `Último uso a ${formatDate(key.last_used_at)}` : "Nunca usada"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-4"
                    onClick={() => revokeKey(key.id)}
                    title="Eliminar Chave"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}