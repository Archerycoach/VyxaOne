import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Copy, Key, Plus, Trash2, Check, Clock, Play, Loader2 } from "lucide-react";

interface GptApiKey {
  id: string;
  name?: string;
  api_key: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

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
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [manualRunLoading, setManualRunLoading] = useState(false);
  const [manualRunResult, setManualRunResult] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from("gpt_api_keys" as any)
        .select("*")
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: GptApiKey[], error: any }>);

      if (error) throw error;
      setKeys(data || []);
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

  const generateNewKey = async () => {
    try {
      setGenerating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilizador não autenticado");

      // Gerar um token aleatório seguro no formato sk_gpt_...
      const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
      const newToken = `sk_gpt_${rawToken}`;

      const { error } = await supabase
        .from("gpt_api_keys" as any)
        .insert({
          user_id: user.id,
          name: "Assistente ChatGPT",
          api_key: newToken,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Chave gerada",
        description: "Nova chave de API criada com sucesso.",
      });

      await loadKeys();
    } catch (error) {
      console.error("Error generating API key:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar uma nova chave.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
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

  const handleManualRun = async () => {
    try {
      setManualRunLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Utilizador não autenticado");

      const res = await fetch("/api/gpt/manual-run", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Erro ao executar o assistente");

      setManualRunResult(data.message);
      toast({
        title: "Análise Concluída",
        description: data.emailSent ? "Resumo gerado e enviado por email." : "Resumo gerado com sucesso.",
      });
    } catch (error: any) {
      console.error("Manual run error:", error);
      toast({
        title: "Erro na Execução",
        description: error.message || "Não foi possível executar o assistente GPT.",
        variant: "destructive",
      });
    } finally {
      setManualRunLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-indigo-600" />
              Assistente GPT Personalizado
            </div>
            <Button 
              onClick={generateNewKey} 
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Gerar Nova Chave
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Faça a gestão das chaves de API usadas para conectar o seu ChatGPT ao CRM. 
          Cada chave tem acesso exclusivo às suas leads e ao seu calendário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center">
            <Key className="h-4 w-4 mr-2" />
            Como configurar no ChatGPT
          </h4>
          <ol className="text-sm text-indigo-800 space-y-1 list-decimal list-inside ml-1">
            <li>Gere uma nova chave abaixo e copie-a.</li>
            <li>No ChatGPT, crie um novo GPT e vá a <strong>Configure &gt; Create new action</strong>.</li>
            <li>Cole o URL <code>https://o-seu-dominio.com/openapi.yaml</code> no campo Schema.</li>
            <li>Na secção <strong>Authentication</strong>, escolha <strong>API Key</strong>, insira a sua chave e selecione o Auth Type <strong>Bearer</strong>.</li>
          </ol>
        </div>

        <div className="flex items-center justify-between p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg mb-6">
          <div>
            <h3 className="font-medium text-indigo-900">Análise Rápida (Execução Manual)</h3>
            <p className="text-sm text-indigo-700 mt-1">
              Peça ao GPT para analisar as suas leads pendentes agora mesmo e gerar um plano de ação para hoje.
            </p>
          </div>
          <Button 
            onClick={handleManualRun} 
            disabled={manualRunLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 ml-4"
          >
            {manualRunLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Gerar Resumo Agora
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Chaves Ativas</h3>
          
          {loading ? (
            <p className="text-sm text-gray-500">A carregar chaves...</p>
          ) : keys.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg bg-gray-50">
              <Bot className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Ainda não tem nenhuma chave gerada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{key.name || "Assistente ChatGPT"}</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-800 break-all ml-2">
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
                    title="Revogar Chave"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={!!manualRunResult} onOpenChange={(open) => !open && setManualRunResult(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Bot className="h-5 w-5" />
              O seu Resumo Diário GPT
            </DialogTitle>
          </DialogHeader>
          <div 
            className="mt-4 text-sm text-gray-700 leading-relaxed prose prose-indigo max-w-none"
            dangerouslySetInnerHTML={{ __html: manualRunResult || "" }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}