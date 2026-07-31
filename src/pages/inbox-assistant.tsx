import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2, CheckCircle, X, User, Flame, Ban, Plus, RefreshCw, Radar, ListPlus, Sparkles, PenLine, Copy, CalendarPlus } from "lucide-react";
import {
  getInboxTriage,
  setTriageStatus,
  getIgnoreSenders,
  setIgnoreSenders,
  getReplyStyle,
  setReplyStyle,
  runInboxNow,
  suggestReply,
  type InboxTriageItem,
} from "@/services/inboxAssistantService";
import { addToRadar, getRadarDefaultCadence, getRadarItemFor } from "@/services/radarService";
import { createTask } from "@/services/tasksService";
import { createCalendarEvent } from "@/services/calendarService";
import { AiFeatureNotice } from "@/components/ai/AiFeatureNotice";

const INTENT_LABEL: Record<string, string> = {
  visita: "Visita",
  proposta: "Proposta",
  pergunta: "Pergunta",
  documento: "Documento",
  agendamento: "Agendamento",
  negociacao: "Negociação",
  nova_lead: "Nova lead",
  outro: "Outro",
};

const IMPORTANCE_META: Record<string, { label: string; className: string }> = {
  high: { label: "Prioritário", className: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "A acompanhar", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Informativo", className: "bg-gray-50 text-gray-600 border-gray-200" },
};

export default function InboxAssistantPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<InboxTriageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ignoreList, setIgnoreList] = useState<string[]>([]);
  const [newIgnore, setNewIgnore] = useState("");
  const [showIgnore, setShowIgnore] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);
  const [replyStyle, setReplyStyleState] = useState("");
  const [styleSaved, setStyleSaved] = useState("");
  const [showStyle, setShowStyle] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);

  const load = async () => {
    try {
      const [triage, ignored, style] = await Promise.all([
        getInboxTriage(),
        getIgnoreSenders(),
        getReplyStyle(),
      ]);
      setItems(triage);
      setIgnoreList(ignored);
      setReplyStyleState(style);
      setStyleSaved(style);
    } finally {
      setLoading(false);
    }
  };

  const saveStyle = async () => {
    setSavingStyle(true);
    try {
      await setReplyStyle(replyStyle);
      setStyleSaved(replyStyle);
      toast({ title: "Estilo guardado", description: "A IA vai adaptar os conselhos a este tom." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSavingStyle(false);
    }
  };

  const handleAddRadar = async (item: InboxTriageItem) => {
    if (!item.lead_id) return;
    setActionBusyId(item.id);
    try {
      const existing = await getRadarItemFor("lead", item.lead_id);
      if (existing) {
        toast({ title: "Já está no Radar", description: "Esta lead já está a ser acompanhada." });
        return;
      }
      const cadence = await getRadarDefaultCadence();
      await addToRadar({
        entityType: "lead",
        entityId: item.lead_id,
        cadenceDays: cadence,
        note: item.reminder || undefined,
      });
      toast({ title: "Adicionado ao Radar", description: "Vais ser avisado até resolver." });
    } catch (error: any) {
      toast({ title: "Erro ao adicionar ao Radar", description: error.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCreateTask = async (item: InboxTriageItem) => {
    setActionBusyId(item.id);
    try {
      const due = new Date();
      due.setDate(due.getDate() + 1);
      await createTask({
        title: item.reminder || "Seguimento de email",
        description: [item.advice, item.agenda_suggestion].filter(Boolean).join(" — ") || null,
        priority: item.importance === "high" ? "high" : item.importance === "low" ? "low" : "medium",
        status: "pending",
        due_date: due.toISOString(),
        related_lead_id: item.lead_id || null,
      } as any);
      toast({ title: "Tarefa criada", description: "Ficou na sua lista de tarefas." });
    } catch (error: any) {
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleScheduleVisit = async (item: InboxTriageItem) => {
    setActionBusyId(item.id);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start);
      end.setHours(11, 0, 0, 0);
      await createCalendarEvent({
        title: `Visita — ${item.from_name || "cliente"}`,
        description: item.reminder || null,
        event_type: "visit",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        lead_id: item.lead_id || null,
      } as any);
      toast({
        title: "Visita agendada (provisória)",
        description: "Ficou amanhã às 10h — ajuste a data/hora na Agenda.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao agendar visita", description: error.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleSuggestReply = async (item: InboxTriageItem) => {
    setDraftBusyId(item.id);
    try {
      const draft = await suggestReply(item.id);
      setDraftById((prev) => ({ ...prev, [item.id]: draft }));
    } catch (error: any) {
      toast({ title: "Erro ao gerar rascunho", description: error.message, variant: "destructive" });
    } finally {
      setDraftBusyId(null);
    }
  };

  const copyDraft = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Rascunho copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const checkNow = async () => {
    setChecking(true);
    try {
      const result = await runInboxNow();
      toast({
        title: result.success ? "Caixa verificada" : "Não foi possível ler a caixa",
        description: result.message,
        variant: result.success ? undefined : "destructive",
      });
      if (result.flagged > 0) await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const saveIgnore = async (next: string[]) => {
    setIgnoreList(next);
    try {
      await setIgnoreSenders(next);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const addIgnore = () => {
    const value = newIgnore.toLowerCase().trim();
    if (!value || ignoreList.includes(value)) {
      setNewIgnore("");
      return;
    }
    saveIgnore([...ignoreList, value]);
    setNewIgnore("");
  };

  const act = async (item: InboxTriageItem, status: "handled" | "dismissed") => {
    setBusyId(item.id);
    try {
      await setTriageStatus(item.id, status);
      setItems((current) => current.filter((i) => i.id !== item.id));
      toast({ title: status === "handled" ? "Marcado como tratado" : "Ignorado" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <SEO title="Assistente de Emails - Vyxa One" description="Emails que merecem a sua atenção" />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Mail className="h-7 w-7 text-indigo-600" />
              <h1 className="text-3xl font-bold">Assistente de Emails</h1>
            </div>
            <Button variant="outline" size="sm" onClick={checkNow} disabled={checking}>
              {checking ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> A verificar...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1.5" /> Verificar agora</>
              )}
            </Button>
          </div>
          <p className="text-muted-foreground mb-4">
            Lembretes e conselhos a partir da sua caixa — respostas de clientes, oportunidades e
            pendências. O assistente lê e aconselha; <strong>não guarda os emails</strong> nem
            escreve ou envia nada. Publicidade, automáticos e as pastas de Spam/Lixo são ignorados.
          </p>

          <AiFeatureNotice feature="O Assistente de Emails" className="mb-4" />


          {/* Filtro: remetentes a ignorar sempre. */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowIgnore((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Ban className="h-4 w-4" />
              Remetentes ignorados ({ignoreList.length})
            </button>
            {showIgnore && (
              <Card className="mt-2">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Adicione um endereço (ex.: <code>promo@loja.pt</code>) ou um domínio inteiro
                    (ex.: <code>@newsletter.pt</code>). Esses nunca são analisados.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={newIgnore}
                      onChange={(e) => setNewIgnore(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addIgnore()}
                      placeholder="email@ ou @dominio"
                      className="h-9"
                    />
                    <Button size="sm" variant="outline" onClick={addIgnore}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {ignoreList.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ignoreList.map((addr) => (
                        <Badge key={addr} variant="outline" className="gap-1">
                          {addr}
                          <button
                            type="button"
                            onClick={() => saveIgnore(ignoreList.filter((a) => a !== addr))}
                            className="hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Estilo/tom de resposta — a IA adapta os conselhos de "como responder". */}
          <div className="mb-6 -mt-2">
            <button
              type="button"
              onClick={() => setShowStyle((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" />
              O meu estilo de resposta {styleSaved ? "(definido)" : "(por definir)"}
            </button>
            {showStyle && (
              <Card className="mt-2">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Descreva o seu tom e forma de responder — a IA adapta os conselhos de "como
                    responder" a este estilo. Ex.: <em>"Cordial mas direto, tratamento por 'você',
                    assino como Eduardo; ofereço sempre uma próxima ação concreta."</em>
                  </p>
                  <Textarea
                    value={replyStyle}
                    onChange={(e) => setReplyStyleState(e.target.value)}
                    placeholder="O seu tom, tratamento, assinatura, hábitos de resposta…"
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={saveStyle} disabled={savingStyle || replyStyle === styleSaved}>
                      {savingStyle ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Guardar estilo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">Sem emails a precisar de atenção</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Quando chegar uma resposta de cliente ou algo a acompanhar, aparece aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {items.map((item) => {
                  const meta = IMPORTANCE_META[item.importance] || IMPORTANCE_META.medium;
                  const busy = busyId === item.id;
                  const acting = actionBusyId === item.id;
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={meta.className}>
                              {meta.label}{item.urgency ? ` · ${item.urgency}/5` : ""}
                            </Badge>
                            {item.intent && item.intent !== "outro" && (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                {INTENT_LABEL[item.intent] || item.intent}
                              </Badge>
                            )}
                            {item.from_name && (
                              <span className="text-xs text-muted-foreground">de {item.from_name}</span>
                            )}
                            {item.lead_id && (
                              <Badge variant="outline" className="gap-1 text-indigo-700 border-indigo-200 bg-indigo-50">
                                <Flame className="h-3 w-3" /> Lead
                              </Badge>
                            )}
                            {item.sender_kind === "portal" && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
                                Portal
                              </Badge>
                            )}
                          </div>
                          {item.reminder && <p className="font-medium mt-1.5">{item.reminder}</p>}
                          {item.advice && (
                            <p className="text-sm mt-2 text-gray-700">
                              <span className="font-medium">Como responder: </span>{item.advice}
                            </p>
                          )}
                          {item.agenda_suggestion && (
                            <p className="text-sm mt-1 text-indigo-700">🗓 {item.agenda_suggestion}</p>
                          )}
                          {item.email_body && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                                📩 Ver email recebido{item.email_subject ? ` — ${item.email_subject}` : ""}
                              </summary>
                              <div className="mt-1.5 rounded-md border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                                {item.email_body}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 flex-wrap">
                        {item.lead_id && (
                          <Button variant="outline" size="sm" onClick={() => router.push(`/leads?leadId=${item.lead_id}`)}>
                            <User className="h-4 w-4 mr-1.5" /> Abrir lead
                          </Button>
                        )}
                        {item.lead_id && (
                          <Button variant="outline" size="sm" disabled={acting} onClick={() => handleAddRadar(item)}>
                            <Radar className="h-4 w-4 mr-1.5 text-amber-600" /> Radar
                          </Button>
                        )}
                        <Button variant="outline" size="sm" disabled={acting} onClick={() => handleCreateTask(item)}>
                          <ListPlus className="h-4 w-4 mr-1.5 text-blue-600" /> Criar tarefa
                        </Button>
                        <Button variant="outline" size="sm" disabled={acting} onClick={() => handleScheduleVisit(item)}>
                          <CalendarPlus className="h-4 w-4 mr-1.5 text-purple-600" /> Marcar visita
                        </Button>
                        <Button variant="outline" size="sm" disabled={draftBusyId === item.id} onClick={() => handleSuggestReply(item)}>
                          {draftBusyId === item.id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <PenLine className="h-4 w-4 mr-1.5 text-indigo-600" />
                          )}
                          Sugerir resposta
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(item, "handled")}>
                          <CheckCircle className="h-4 w-4 mr-1.5 text-green-600" /> Tratado
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(item, "dismissed")}>
                          <X className="h-4 w-4 mr-1.5 text-gray-500" /> Ignorar
                        </Button>
                      </div>

                      {draftById[item.id] !== undefined && (
                        <div className="mt-3 rounded-lg border bg-slate-50 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-slate-600">
                              Rascunho sugerido (reveja antes de enviar — nada é enviado automaticamente)
                            </span>
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => copyDraft(draftById[item.id])}>
                              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap text-slate-800">{draftById[item.id]}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
