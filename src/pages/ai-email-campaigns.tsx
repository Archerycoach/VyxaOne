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
  recipients: Array<{
    id: string;
    name: string;
    email: string | null;
    status: string | null;
    location_preference: string | null;
    typology: string | null;
  }>;
}

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

    let prompt = "Prepara um email para todas as leads";

    if (criteriaSentence) {
      prompt += ` que procuram ${criteriaSentence}`;
    }

    if (extraInstructions.trim()) {
      prompt += `. ${extraInstructions.trim()}`;
    }

    return prompt;
  };

  const openDraftInBulkMessages = () => {
    if (!latestCampaignDraft) {
      return;
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
    if (!location.trim() && typology === "all" && buyPurpose === "all" && propertyType === "all") {
      toast({
        title: "Critérios em falta",
        description: "Defina pelo menos uma zona, tipologia, objetivo ou tipo de imóvel.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setAssistantReply("");
    setLatestCampaignDraft(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await fetch("/api/gpt/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: buildPrompt(),
          history: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Falha ao gerar rascunho");
      }

      setAssistantReply(data.reply || "");
      setLatestCampaignDraft(data.campaignDraft || null);
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
              <Link href="/ai-agent">
                <Button variant="outline">Voltar ao Agente IA</Button>
              </Link>
            </div>

            <Alert className="border-indigo-200 bg-indigo-50">
              <AlertDescription>
                Este fluxo apenas prepara o rascunho e pré-seleciona as leads com email. O envio final acontece na área de Mensagens, depois da sua revisão.
              </AlertDescription>
            </Alert>

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
                      Indique o perfil de procura para a IA encontrar as leads certas e escrever o email.
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
                        placeholder="Ex: usa um tom consultivo e menciona que temos novas oportunidades em carteira."
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
                      A IA usa os critérios da procura para preparar uma campanha antes de qualquer envio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-700">
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">1. Segmentação</p>
                      <p className="mt-1">Filtra leads por zona, tipologia, objetivo da compra e tipo de imóvel.</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">2. Rascunho IA</p>
                      <p className="mt-1">Gera assunto e corpo do email em português, com base no segmento encontrado.</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium text-gray-900">3. Revisão manual</p>
                      <p className="mt-1">Abre em Mensagens com as leads pré-selecionadas, sem envio automático.</p>
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
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </Layout>
      </AppWrapper>
    </ProtectedRoute>
  );
}