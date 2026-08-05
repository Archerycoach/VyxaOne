import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Loader2, Save, Sparkles, RotateCcw, GraduationCap, Check, X } from "lucide-react";
import {
  getAiProfile, saveAiProfile, composeProfileFromAnswers, learnFromMyEmails,
  type ConsultantProfile, type ProfileQuestion, type ProfileSlot,
} from "@/services/aiProfileService";
import { getAiActions, decideAiActions, type AiActionItem } from "@/services/aiActionsService";

const SLOT_META: Record<ProfileSlot, { titulo: string; ajuda: string }> = {
  identity: {
    titulo: "Quem sou",
    ajuda: "Mercado, zona, tipo de cliente e o que te distingue.",
  },
  voice: {
    titulo: "Como escrevo",
    ajuda: "Tratamento, comprimento, abertura e assinatura, expressões a evitar. Quanto mais concreto, melhor a IA te imita.",
  },
  method: {
    titulo: "Como trabalho",
    ajuda: "Canais, tempos de resposta, cadência de seguimento.",
  },
  boundaries: {
    titulo: "O que nunca fazer",
    ajuda: "Passa à frente de qualquer outra instrução dada à IA.",
  },
};

const SLOTS: ProfileSlot[] = ["identity", "voice", "method", "boundaries"];

export default function AiProfilePage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);

  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [questions, setQuestions] = useState<ProfileQuestion[]>([]);
  const [maxChars, setMaxChars] = useState(600);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<ProfileSlot, string>>({
    identity: "", voice: "", method: "", boundaries: "",
  });
  const [proposta, setProposta] = useState(false);

  const [learning, setLearning] = useState(false);
  const [learnMsg, setLearnMsg] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<AiActionItem[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  const loadPendentes = async () => {
    try {
      const acoes = await getAiActions("pending");
      setPendentes(acoes.filter((a) => a.capability === "profile_voice"));
    } catch {
      // A caixa de propostas é um extra — não pode impedir a página de abrir.
      setPendentes([]);
    }
  };

  const load = async () => {
    try {
      const data = await getAiProfile();
      setQuestions(data.questions);
      setMaxChars(data.maxChars);
      setProfile(data.profile);
      setAnswers(data.profile?.questionnaire || {});
      setSlots({
        identity: data.profile?.identity || "",
        voice: data.profile?.voice || "",
        method: data.profile?.method || "",
        boundaries: data.profile?.boundaries || "",
      });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadPendentes();
  }, []);

  const handleLearn = async () => {
    setLearning(true);
    setLearnMsg(null);
    try {
      const r = await learnFromMyEmails();
      if (r.proposed) {
        setLearnMsg(null);
        toast({
          title: "Proposta criada",
          description: `A partir de ${r.samples} emails que corrigiste. Lê em baixo antes de aplicar.`,
        });
        await loadPendentes();
      } else {
        setLearnMsg(r.message || "Sem alterações a propor.");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLearning(false);
    }
  };

  const handleDecide = async (id: string, decision: "approve" | "reject") => {
    setDeciding(id);
    try {
      await decideAiActions([id], decision);
      toast({
        title: decision === "approve" ? "Perfil atualizado" : "Proposta rejeitada",
        description: decision === "approve" ? "Podes desfazer na caixa de ações da IA." : undefined,
      });
      await Promise.all([load(), loadPendentes()]);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setDeciding(null);
    }
  };

  const handleCompose = async () => {
    setComposing(true);
    try {
      const propostos = await composeProfileFromAnswers(answers);
      setSlots(propostos);
      setProposta(true);
      toast({
        title: "Perfil composto",
        description: "Lê e corrige o que quiseres antes de guardar. Nada foi gravado ainda.",
      });
    } catch (error: any) {
      toast({ title: "Não foi possível compor", description: error.message, variant: "destructive" });
    } finally {
      setComposing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const atualizado = await saveAiProfile({
        slots,
        questionnaire: answers,
        source: proposta ? "questionnaire" : "manual",
      });
      setProfile(atualizado);
      setProposta(false);
      toast({ title: "Perfil guardado", description: "A IA passa a usá-lo em tudo o que escreve." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      const atualizado = await saveAiProfile({ enabled });
      setProfile(atualizado);
      toast({ title: enabled ? "Perfil ativo" : "Perfil desligado" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleReset = () => {
    setSlots({
      identity: profile?.identity || "",
      voice: profile?.voice || "",
      method: profile?.method || "",
      boundaries: profile?.boundaries || "",
    });
    setProposta(false);
  };

  const preenchidas = Object.values(answers).filter((v) => String(v || "").trim()).length;

  return (
    <ProtectedRoute>
      <SEO title="Perfil da IA | Vyxa One" />
      <Layout>
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Fingerprint className="h-6 w-6" />
                Perfil da IA
              </h1>
              <p className="text-muted-foreground mt-1">
                Quem és, como escreves e como trabalhas. A IA lê isto <strong>sempre</strong> —
                em cada email, sugestão ou resposta — para soar a ti e não a um assistente genérico.
              </p>
            </div>

            {profile ? (
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="perfil-ativo" className="text-sm">Ativo</Label>
                <Switch
                  id="perfil-ativo"
                  checked={profile.enabled}
                  onCheckedChange={handleToggle}
                />
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Questionário */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-semibold">Questionário</h2>
                      <p className="text-sm text-muted-foreground">
                        Responde ao que souberes — não é preciso responder a tudo. Depois a IA
                        transforma isto no teu perfil, e tu corriges antes de guardar.
                      </p>
                    </div>
                    <Badge variant="outline">{preenchidas}/{questions.length}</Badge>
                  </div>

                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div key={q.id}>
                        <Label htmlFor={`q-${q.id}`} className="text-sm">
                          {i + 1}. {q.question}
                        </Label>
                        <Textarea
                          id={`q-${q.id}`}
                          value={answers[q.id] || ""}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          placeholder={q.placeholder}
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleCompose} disabled={composing || preenchidas === 0}>
                    {composing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {composing ? "A compor…" : "Compor perfil com estas respostas"}
                  </Button>
                </CardContent>
              </Card>

              {/* Os quatro papéis */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-semibold">O perfil</h2>
                      <p className="text-sm text-muted-foreground">
                        É isto que a IA lê. Podes escrever à mão, sem passar pelo questionário.
                      </p>
                    </div>
                    {proposta ? (
                      <Badge className="bg-amber-100 text-amber-700">Proposta por gravar</Badge>
                    ) : null}
                  </div>

                  {SLOTS.map((slot) => {
                    const usado = (slots[slot] || "").length;
                    const excedeu = usado > maxChars;
                    return (
                      <div key={slot}>
                        <div className="flex items-baseline justify-between gap-2">
                          <Label htmlFor={`slot-${slot}`}>{SLOT_META[slot].titulo}</Label>
                          <span className={`text-xs ${excedeu ? "text-red-600" : "text-muted-foreground"}`}>
                            {usado}/{maxChars}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{SLOT_META[slot].ajuda}</p>
                        <Textarea
                          id={`slot-${slot}`}
                          value={slots[slot]}
                          onChange={(e) => setSlots({ ...slots, [slot]: e.target.value })}
                          rows={4}
                        />
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Guardar perfil
                    </Button>
                    {proposta ? (
                      <Button variant="outline" onClick={handleReset} disabled={saving}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Descartar proposta
                      </Button>
                    ) : null}
                    {profile?.updated_at && !proposta ? (
                      <span className="text-xs text-muted-foreground">
                        Atualizado em {new Date(profile.updated_at).toLocaleString("pt-PT")}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {/* Aprendizagem com as correções aos rascunhos */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Aprender contigo
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Sempre que corriges um rascunho de email antes de enviar, guardo o par.
                      Comparo os dois e proponho ajustes ao teu perfil — só quando o mesmo
                      padrão se repete em vários emails. Nada é aplicado sem tu aprovares.
                    </p>
                  </div>

                  <Button variant="outline" onClick={handleLearn} disabled={learning}>
                    {learning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GraduationCap className="h-4 w-4 mr-2" />}
                    {learning ? "A analisar…" : "Analisar os meus emails"}
                  </Button>

                  {learnMsg ? <p className="text-sm text-muted-foreground">{learnMsg}</p> : null}

                  {pendentes.map((acao) => (
                    <div key={acao.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-700">Proposta</Badge>
                        <span className="text-sm font-medium">{acao.title}</span>
                      </div>
                      {acao.reason ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{acao.reason}</p>
                      ) : null}
                      {acao.source ? (
                        <p className="text-xs text-muted-foreground">Baseado em: {acao.source}</p>
                      ) : null}

                      {Object.entries((acao.payload?.slots || {}) as Record<string, string>).map(([slot, texto]) => (
                        <div key={slot} className="rounded bg-muted/50 p-2">
                          <p className="text-xs font-medium mb-1">
                            {SLOT_META[slot as ProfileSlot]?.titulo || slot} — proposto
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{texto}</p>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleDecide(acao.id, "approve")} disabled={deciding === acao.id}>
                          {deciding === acao.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                          Aplicar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecide(acao.id, "reject")} disabled={deciding === acao.id}>
                          <X className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
