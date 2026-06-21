import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AppWrapper } from "@/components/AppWrapper";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, Users } from "lucide-react";

interface EmailCampaignDraft {
  criteria: {
    location: string | null;
    typology: string | null;
    bedrooms: number | null;
    buyPurpose: string | null;
    propertyType: string | null;
  };
  filterSummary: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientLeadIds?: string[];
  matchedLeadCount?: number;
  missingEmailCount?: number;
  recipients: Array<{
    id: string;
    name: string;
    email: string | null;
    status: string | null;
    location_preference: string | null;
    typology: string | null;
  }>;
}

interface CampaignConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface EmailCampaignDebugInfo {
  requestPrompt: string;
  requestHistoryCount: number;
  apiStatus: number | null;
  contentType: string | null;
  errorMessage: string | null;
  backendDebug: unknown;
  rawResponseText: string | null;
  updatedAt: string;
}

const AI_DRAFT_STORAGE_KEY = "vyxa-ai-email-campaign-draft";

export default function AiEmailCampaignsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [hasGptConnection, setHasGptConnection] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [location, setLocation] = useState("");
  const [typology, setTypology] = useState("all");
  const [buyPurpose, setBuyPurpose] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [latestCampaignDraft, setLatestCampaignDraft] = useState<EmailCampaignDraft | null>(null);
  const [conversationHistory, setConversationHistory] = useState<CampaignConversationMessage[]>([]);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<EmailCampaignDebugInfo | null>(null);

  useEffect(() => {
    const loadConnectionStatus = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setHasGptConnection(false);
          return;
        }

        const keysRes = await (supabase.from("gpt_api_keys" as any).select("id").eq("user_id", user.id).limit(1) as any);
        setHasGptConnection(Boolean(keysRes.data && keysRes.data.length > 0));
      } catch (error) {
        console.error("Erro ao verificar ligação GPT:", error);
        setHasGptConnection(false);
      } finally {
        setIsCheckingConnection(false);
      }
    };

    loadConnectionStatus();
  }, []);

  const buildPrompt = () => {
    const criteriaParts: string[] = [];

    if (typology !== "all") {
      criteriaParts.push(typology);
    }

    if (propertyType !== "all") {
      const propertyTypeLabels: Record<string, string> = {
        apartment: "apartamento",
        house: "moradia",
        land: "terreno",
        commercial: "imóvel comercial",
        store: "loja",
      };
      criteriaParts.push(propertyTypeLabels[propertyType] || propertyType);
    }

    if (location.trim()) {
      criteriaParts.push(`na zona de ${location.trim()}`);
    }

    if (buyPurpose !== "all") {
      const purposeLabels: Record<string, string> = {
        housing: "habitação própria",
        investment: "investimento",
        secondary: "segunda habitação",
      };
      criteriaParts.push(`com objetivo ${purposeLabels[buyPurpose] || buyPurpose}`);
    }

    const criteriaSentence = criteriaParts.join(", ");

    const trimmedInstructions = extraInstructions.trim();

    if (criteriaSentence && trimmedInstructions) {
      return `Prepara um email e seleciona as leads certas que procuram ${criteriaSentence}. Usa também estas instruções para afinar a audiência e o tom: ${trimmedInstructions}`;
    }

    if (criteriaSentence) {
      return `Prepara um email e seleciona as leads certas que procuram ${criteriaSentence}.`;
    }

    if (trimmedInstructions) {
      return `Prepara um email e seleciona as leads certas apenas com base nestas instruções: ${trimmedInstructions}`;
    }

    return "Prepara um email e seleciona automaticamente as leads mais relevantes com base no contexto completo da minha carteira.";
  };

  const buildCampaignContext = (draft: EmailCampaignDraft | null = latestCampaignDraft) => ({
    mode: "email_campaign" as const,
    criteria: draft?.criteria || {
      location: location.trim() || null,
      typology: typology !== "all" ? typology : null,
      bedrooms: typology !== "all" ? Number(typology.replace("T", "")) : null,
      buyPurpose: buyPurpose !== "all" ? buyPurpose : null,
      propertyType: propertyType !== "all" ? propertyType : null,
    },
    previousDraft: draft
      ? {
          subject: draft.subject,
          htmlBody: draft.htmlBody,
          textBody: draft.textBody,
        }
      : null,
    recipientLeadIds:
      draft?.recipientLeadIds || draft?.recipients.map((recipient) => recipient.id) || null,
  });

  const requestCampaignDraft = async (
    prompt: string,
    options?: { resetConversation?: boolean; draftContext?: EmailCampaignDraft | null },
  ) => {
    const historyPayload = options?.resetConversation ? [] : conversationHistory;
    const requestPayload = {
      message: prompt,
      history: historyPayload,
      campaignContext: buildCampaignContext(options?.draftContext ?? latestCampaignDraft),
      debug: debugMode,
    };

    try {
      const response = await fetch("/api/gpt/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const contentType = response.headers.get("content-type");
      let data: any = null;
      let rawResponseText: string | null = null;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        rawResponseText = await response.text();
        if (rawResponseText) {
          try {
            data = JSON.parse(rawResponseText);
          } catch {
            data = null;
          }
        }
      }

      const nextDebugInfo: EmailCampaignDebugInfo = {
        requestPrompt: prompt,
        requestHistoryCount: historyPayload.length,
        apiStatus: response.status,
        contentType: contentType || null,
        errorMessage: response.ok
          ? null
          : data?.error || data?.message || rawResponseText || `Falha ao gerar rascunho (HTTP ${response.status})`,
        backendDebug: data && typeof data === "object" ? data.debug ?? null : null,
        rawResponseText,
        updatedAt: new Date().toISOString(),
      };

      setDebugInfo(nextDebugInfo);

      if (!response.ok) {
        throw new Error(nextDebugInfo.errorMessage || "Falha ao gerar rascunho");
      }

      if (!data || typeof data !== "object") {
        throw new Error("A resposta do servidor não veio em JSON válido.");
      }

      const assistantMessage = data.reply || "";
      const updatedHistory: CampaignConversationMessage[] = [
        ...(options?.resetConversation ? [] : conversationHistory),
        { role: "user", content: prompt },
        { role: "assistant", content: assistantMessage },
      ];

      setConversationHistory(updatedHistory);
      setAssistantReply(assistantMessage);
      setLatestCampaignDraft(data.campaignDraft || null);
    } catch (error) {
      setDebugInfo((current) => ({
        requestPrompt: current?.requestPrompt || prompt,
        requestHistoryCount: current?.requestHistoryCount ?? historyPayload.length,
        apiStatus: current?.apiStatus ?? null,
        contentType: current?.contentType ?? null,
        errorMessage: error instanceof Error ? error.message : "Falha desconhecida no pedido.",
        backendDebug: current?.backendDebug ?? null,
        rawResponseText: current?.rawResponseText ?? null,
        updatedAt: new Date().toISOString(),
      }));
      throw error;
    }
  };

  const openDraftInBulkMessages = () => {
    if (!latestCampaignDraft) {
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        AI_DRAFT_STORAGE_KEY,
        JSON.stringify({
          recipients: latestCampaignDraft.recipients,
          recipientLeadIds: latestCampaignDraft.recipientLeadIds || latestCampaignDraft.recipients.map((recipient) => recipient.id),
          matchedLeadCount: latestCampaignDraft.matchedLeadCount ?? latestCampaignDraft.recipients.length,
          missingEmailCount: latestCampaignDraft.missingEmailCount ?? 0,
          filterSummary: latestCampaignDraft.filterSummary,
        }),
      );
    }

    const query: Record<string, string> = {
      aiDraft: "1",
      source: "leads",
      subject: latestCampaignDraft.subject,
      message: latestCampaignDraft.htmlBody,
    };

    if (latestCampaignDraft.criteria.location) {
      query.location = latestCampaignDraft.criteria.location;
    }

    if (latestCampaignDraft.criteria.typology) {
      query.typology = latestCampaignDraft.criteria.typology;
    }

    if (latestCampaignDraft.criteria.buyPurpose) {
      query.buyPurpose = latestCampaignDraft.criteria.buyPurpose;
    }

    if (latestCampaignDraft.criteria.propertyType) {
      query.propertyType = latestCampaignDraft.criteria.propertyType;
    }

    router.push({
      pathname: "/bulk-messages",
      query,
    });
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    setAssistantReply("");
    setConversationHistory([]);
    setLatestCampaignDraft(null);
    setDebugInfo(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      await requestCampaignDraft(buildPrompt(), { resetConversation: true, draftContext: null });
    } catch (error) {
      console.error("Erro ao gerar campanha IA:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível gerar o rascunho.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineDraft = async () => {
    if (!latestCampaignDraft) {
      toast({
        title: "Rascunho em falta",
        description: "Gere primeiro um rascunho antes de pedir ajustes ao agente.",
        variant: "destructive",
      });
      return;
    }

    if (!refinementPrompt.trim()) {
      toast({
        title: "Instruções em falta",
        description: "Escreva o ajuste que quer pedir ao agente.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      await requestCampaignDraft(refinementPrompt.trim(), {
        resetConversation: false,
        draftContext: latestCampaignDraft,
      });
      setRefinementPrompt("");
    } catch (error) {
      console.error("Erro ao refinar campanha IA:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível refinar o rascunho.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppWrapper>
        <SEO title="Emails por Procura IA" description="Crie campanhas de email para leads segmentadas por procura." />
        <Layout>
          <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-8 w-8 text-indigo-600" />
                  Emails por Procura
                </h1>
                <p className="text-gray-500 mt-1">
                  A IA prepara o email e segmenta as leads segundo a procura. O envio continua sempre com revisão manual.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDebugMode((value) => !value)}>
                  {debugMode ? "Ocultar debug" : "Mostrar debug"}
                </Button>
                <Link href="/ai-agent">
                  <Button variant="outline">Voltar ao Agente IA</Button>
                </Link>
              </div>
            </div>

            <Alert className="border-indigo-200 bg-indigo-50">
              <AlertDescription>
                Este fluxo usa o agente IA para segmentar, rever e refinar o email antes do envio. Quando abrir em Mensagens, segue a seleção exata das leads escolhidas pelo agente.
              </AlertDescription>
            </Alert>

            {debugMode && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    Debug da geração do email
                    <Badge variant="outline">
                      {debugInfo?.errorMessage ? "Último erro" : "À espera de execução"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Use este painel para perceber se a falha vem da autenticação, da API, do parse da resposta ou da IA. Reproduza o erro e envie-me estes detalhes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!debugInfo ? (
                    <p className="text-gray-700">
                      Ainda não há dados de debug. Clique em “Gerar email com IA” para registar o próximo pedido.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Estado HTTP</p>
                          <p className="mt-1 text-gray-700">{debugInfo.apiStatus ?? "sem resposta"}</p>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Content-Type</p>
                          <p className="mt-1 break-all text-gray-700">{debugInfo.contentType || "desconhecido"}</p>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Mensagens no histórico</p>
                          <p className="mt-1 text-gray-700">{debugInfo.requestHistoryCount}</p>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Última atualização</p>
                          <p className="mt-1 break-all text-gray-700">{debugInfo.updatedAt}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3">
                        <p className="font-medium text-gray-900">Prompt enviado</p>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-gray-700">
                          {debugInfo.requestPrompt}
                        </pre>
                      </div>

                      {debugInfo.errorMessage && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="font-medium text-red-800">Erro visível</p>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-900">
                            {debugInfo.errorMessage}
                          </pre>
                        </div>
                      )}

                      {debugInfo.rawResponseText && (
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Resposta bruta do servidor</p>
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                            {debugInfo.rawResponseText}
                          </pre>
                        </div>
                      )}

                      {debugInfo.backendDebug && (
                        <div className="rounded-lg border bg-white p-3">
                          <p className="font-medium text-gray-900">Debug devolvido pela API</p>
                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                            {JSON.stringify(debugInfo.backendDebug, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {isCheckingConnection ? (
              <Card>
                <CardContent className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                </CardContent>
              </Card>
            ) : !hasGptConnection ? (
              <Card>
                <CardContent className="py-8 text-center space-y-4">
                  <p className="text-gray-700">Precisa de configurar a ligação ao ChatGPT antes de gerar campanhas por procura.</p>
                  <Link href="/settings?tab=gpt-agent">
                    <Button className="bg-indigo-600 hover:bg-indigo-700">Configurar ligação GPT</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Critérios da campanha</CardTitle>
                    <CardDescription>
                      Os filtros são opcionais. Pode deixá-los em branco e escrever apenas instruções livres para a IA encontrar as leads certas e escrever o email.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Zona</Label>
                      <Input
                        id="location"
                        placeholder="Ex: Matosinhos, Foz, Cascais"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipologia</Label>
                      <Select value={typology} onValueChange={setTypology}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a tipologia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer tipologia</SelectItem>
                          <SelectItem value="T0">T0</SelectItem>
                          <SelectItem value="T1">T1</SelectItem>
                          <SelectItem value="T2">T2</SelectItem>
                          <SelectItem value="T3">T3</SelectItem>
                          <SelectItem value="T4">T4</SelectItem>
                          <SelectItem value="T5">T5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Objetivo da compra</Label>
                      <Select value={buyPurpose} onValueChange={setBuyPurpose}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o objetivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer objetivo</SelectItem>
                          <SelectItem value="housing">Habitação própria</SelectItem>
                          <SelectItem value="investment">Investimento</SelectItem>
                          <SelectItem value="secondary">Segunda habitação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de imóvel</Label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de imóvel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer tipo</SelectItem>
                          <SelectItem value="apartment">Apartamento</SelectItem>
                          <SelectItem value="house">Moradia</SelectItem>
                          <SelectItem value="land">Terreno</SelectItem>
                          <SelectItem value="commercial">Comercial</SelectItem>
                          <SelectItem value="store">Loja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructions">Instruções adicionais</Label>
                      <Textarea
                        id="instructions"
                        rows={5}
                        placeholder="Ex: escreve para leads interessadas em investir em novos empreendimentos no Porto e usa um tom consultivo."
                        value={extraInstructions}
                        onChange={(event) => setExtraInstructions(event.target.value)}
                      />
                    </div>

                    <Button
                      onClick={handleGenerateDraft}
                      disabled={isGenerating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          A gerar rascunho...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Gerar email com IA
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Como funciona</CardTitle>
                    <CardDescription>
                      A IA usa os critérios da procura, a carteira e a conversa atual para preparar a campanha antes de qualquer envio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-700">
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">1. Segmentação</p>
                      <p className="mt-1">Segmenta as leads com a mesma lógica do agente IA e cruza a procura com a tua carteira.</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">2. Rascunho IA</p>
                      <p className="mt-1">Gera assunto e corpo do email em português, com base no segmento encontrado e no histórico da conversa.</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">3. Afinação e revisão</p>
                      <p className="mt-1">Pode pedir ajustes ao agente e só depois abrir em Mensagens com as leads exatas pré-selecionadas.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {assistantReply && (
              <Alert>
                <AlertDescription>{assistantReply}</AlertDescription>
              </Alert>
            )}

            {latestCampaignDraft && (
              <Card>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>Rascunho preparado</CardTitle>
                    <CardDescription>
                      {latestCampaignDraft.recipients.length} leads com email no segmento {latestCampaignDraft.filterSummary || "definido"}.
                      {typeof latestCampaignDraft.matchedLeadCount === "number" && (
                        <> Total compatíveis: {latestCampaignDraft.matchedLeadCount}. Sem email: {latestCampaignDraft.missingEmailCount || 0}.</>
                      )}
                    </CardDescription>
                  </div>
                  <Button onClick={openDraftInBulkMessages} className="bg-indigo-600 hover:bg-indigo-700">
                    Abrir em Mensagens
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[1fr,1.1fr]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Users className="h-4 w-4" />
                      Leads abrangidas
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latestCampaignDraft.recipients.slice(0, 8).map((recipient) => (
                        <Badge key={recipient.id} variant="secondary" className="py-1.5">
                          {recipient.name}
                        </Badge>
                      ))}
                    </div>
                    {latestCampaignDraft.recipients.length > 8 && (
                      <p className="text-xs text-gray-500">
                        +{latestCampaignDraft.recipients.length - 8} leads adicionais serão pré-selecionadas em Mensagens.
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Assunto</p>
                      <p className="text-sm text-gray-700 mt-1">{latestCampaignDraft.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mensagem</p>
                      <div
                        className="mt-2 rounded-lg border p-4 text-sm text-gray-700 space-y-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: latestCampaignDraft.htmlBody }}
                      />
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Afinar com o agente</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Peça ajustes ao segmento ou ao tom do email. Exemplo: “deixa mais consultivo” ou “foca primeiro nas leads de investimento”.
                        </p>
                      </div>
                      <Textarea
                        rows={3}
                        placeholder="Ex: deixa o email mais curto e com foco em investidores de Matosinhos."
                        value={refinementPrompt}
                        onChange={(event) => setRefinementPrompt(event.target.value)}
                      />
                      <Button
                        onClick={handleRefineDraft}
                        disabled={isGenerating}
                        variant="outline"
                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            A refinar...
                          </>
                        ) : (
                          "Pedir ajuste ao agente"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {conversationHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Conversa com o agente</CardTitle>
                  <CardDescription>
                    Histórico da afinação do segmento e do rascunho antes de enviar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conversationHistory.map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`rounded-lg border p-3 text-sm ${
                        entry.role === "user"
                          ? "border-slate-200 bg-slate-50 text-slate-800"
                          : "border-indigo-200 bg-indigo-50 text-indigo-950"
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                        {entry.role === "user" ? "Pedido" : "Agente IA"}
                      </p>
                      <p className="whitespace-pre-wrap">{entry.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </Layout>
      </AppWrapper>
    </ProtectedRoute>
  );
}