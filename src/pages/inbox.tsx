import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Mail, Search, Send, RefreshCw, Inbox as InboxIcon, ArrowLeft, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getInteractionsByLead, type InteractionWithDetails } from "@/services/interactionsService";
import { getMessageSnippets, personalizeSnippet, type MessageSnippet } from "@/services/messageSnippetsService";

interface ConversationLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface ConversationSummary {
  lead: ConversationLead;
  lastInteractionType: string;
  lastContent: string;
  lastAt: string;
  lastInboundAt: string | null;
  unread: boolean;
}

// Mesmo padrão de limpeza de prefixos usado no chat de WhatsApp da ficha da
// lead, para manter a leitura consistente em toda a aplicação.
function cleanContent(content: string | null): string {
  if (!content) return "";
  return content.replace(/^(Recebido: |Enviado \(IA\): |Enviado \(Automático\): |Enviado \(Manual[^)]*\): )/, "");
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return date.toLocaleDateString("pt-PT");
}

export default function InboxPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<ConversationLead | null>(null);
  const [thread, setThread] = useState<InteractionWithDetails[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [snippets, setSnippets] = useState<MessageSnippet[]>([]);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const { data: interactionsData, error } = await supabase
        .from("interactions")
        .select(`
          id, lead_id, interaction_type, content, interaction_date,
          leads!interactions_lead_id_fkey ( id, name, email, phone )
        `)
        .in("interaction_type", ["whatsapp_inbound", "whatsapp_outbound", "email"])
        .not("lead_id", "is", null)
        .order("interaction_date", { ascending: false })
        .limit(300);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      // NOTA: "inbox_read_state" só existe depois de correr a migração
      // supabase/migrations/20260701170040_*.sql e regenerar
      // database.types.ts — até lá usamos "as any" no nome da tabela, o
      // mesmo padrão já usado no resto do código para tabelas recentes.
      const { data: readStateData } = user
        ? await supabase.from("inbox_read_state" as any).select("lead_id, last_read_at").eq("user_id", user.id)
        : { data: [] as any[] };

      const readStateMap = new Map<string, string>(
        (readStateData || []).map((row: any) => [row.lead_id, row.last_read_at])
      );

      const byLead = new Map<string, ConversationSummary>();
      for (const row of (interactionsData || []) as any[]) {
        const leadInfo = row.leads as ConversationLead | null;
        if (!leadInfo) continue;

        const existing = byLead.get(leadInfo.id);
        const isInbound = row.interaction_type === "whatsapp_inbound";

        if (!existing) {
          byLead.set(leadInfo.id, {
            lead: leadInfo,
            lastInteractionType: row.interaction_type,
            lastContent: cleanContent(row.content),
            lastAt: row.interaction_date,
            lastInboundAt: isInbound ? row.interaction_date : null,
            unread: false,
          });
        } else if (isInbound && !existing.lastInboundAt) {
          // A lista já vem ordenada por data decrescente, por isso a primeira
          // ocorrência inbound que encontramos para este lead é a mais recente.
          existing.lastInboundAt = row.interaction_date;
        }
      }

      const list = Array.from(byLead.values()).map((conv) => {
        const lastRead = readStateMap.get(conv.lead.id);
        const unread = Boolean(conv.lastInboundAt && (!lastRead || new Date(conv.lastInboundAt) > new Date(lastRead)));
        return { ...conv, unread };
      });

      list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
      setConversations(list);
    } catch (error: any) {
      console.error("[Inbox] Erro ao carregar conversas:", error);
      toast({ title: "Erro ao carregar caixa de entrada", description: error.message, variant: "destructive" });
    } finally {
      setLoadingConversations(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    getMessageSnippets("whatsapp").then(setSnippets).catch((err) => console.error("[Inbox] Erro ao carregar respostas rápidas:", err));
  }, []);

  const openConversation = useCallback(async (lead: ConversationLead) => {
    setSelectedLead(lead);
    setLoadingThread(true);
    try {
      const data = await getInteractionsByLead(lead.id);
      setThread(data.filter((i) => ["whatsapp_inbound", "whatsapp_outbound", "email"].includes(i.interaction_type)));

      // Marca como lida
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("inbox_read_state" as any).upsert(
          { user_id: user.id, lead_id: lead.id, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,lead_id" }
        );
        setConversations((prev) => prev.map((c) => (c.lead.id === lead.id ? { ...c, unread: false } : c)));
      }
    } catch (error: any) {
      toast({ title: "Erro ao abrir conversa", description: error.message, variant: "destructive" });
    } finally {
      setLoadingThread(false);
    }
  }, [toast]);

  // Deep-link: ?leadId=... abre diretamente essa conversa quando as
  // conversas já estiverem carregadas.
  useEffect(() => {
    const queryLeadId = router.query.leadId;
    if (typeof queryLeadId !== "string" || conversations.length === 0 || selectedLead) return;
    const match = conversations.find((c) => c.lead.id === queryLeadId);
    if (match) openConversation(match.lead);
  }, [router.query.leadId, conversations, selectedLead, openConversation]);

  const handleReply = async () => {
    if (!selectedLead || !replyText.trim()) return;
    if (!selectedLead.phone) {
      toast({ title: "Sem número de telefone", description: "Esta lead não tem telefone associado.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ lead_id: selectedLead.id, type: "text", content: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar mensagem");

      setReplyText("");
      const updated = await getInteractionsByLead(selectedLead.id);
      setThread(updated.filter((i) => ["whatsapp_inbound", "whatsapp_outbound", "email"].includes(i.interaction_type)));
      loadConversations();
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const insertSnippet = (snippet: MessageSnippet) => {
    if (!selectedLead) return;
    const personalized = personalizeSnippet(snippet.content, {
      name: selectedLead.name,
      email: selectedLead.email,
      phone: selectedLead.phone,
    });
    setReplyText((prev) => (prev.trim() ? `${prev} ${personalized}` : personalized));
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const term = search.trim().toLowerCase();
    return conversations.filter(
      (c) => c.lead.name?.toLowerCase().includes(term) || c.lead.email?.toLowerCase().includes(term) || c.lead.phone?.includes(term)
    );
  }, [conversations, search]);

  return (
    <ProtectedRoute>
      <Layout title="Caixa de Entrada">
        <div className="h-[calc(100vh-64px)] flex overflow-hidden">
          {/* Lista de conversas */}
          <div className={`w-full sm:w-80 border-r bg-white flex-col shrink-0 ${selectedLead ? "hidden sm:flex" : "flex"}`}>
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <InboxIcon className="h-5 w-5 text-indigo-600" />
                  Caixa de Entrada
                </h1>
                <Button variant="ghost" size="icon" onClick={loadConversations} disabled={loadingConversations}>
                  <RefreshCw className={`h-4 w-4 ${loadingConversations ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
                <Input
                  placeholder="Pesquisar lead..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4 text-gray-400">
                  <MessageCircle className="h-10 w-10 mb-2" />
                  <p className="text-sm">Nenhuma conversa de WhatsApp ou email ainda.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.lead.id}
                    onClick={() => openConversation(conv.lead)}
                    className={`w-full text-left p-3 border-b hover:bg-gray-50 transition-colors flex items-start gap-2 ${
                      selectedLead?.id === conv.lead.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className={`mt-1 shrink-0 ${conv.lastInteractionType === "email" ? "text-blue-500" : "text-green-500"}`}>
                      {conv.lastInteractionType === "email" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${conv.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                          {conv.lead.name}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">{relativeTime(conv.lastAt)}</span>
                      </div>
                      <p className={`text-xs truncate ${conv.unread ? "text-slate-700 font-medium" : "text-gray-500"}`}>
                        {conv.lastContent || "(sem texto)"}
                      </p>
                    </div>
                    {conv.unread && <div className="h-2 w-2 rounded-full bg-indigo-600 mt-2 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Painel da conversa */}
          <div className={`flex-1 flex-col bg-[#f0f2f5] ${selectedLead ? "flex" : "hidden sm:flex"}`}>
            {!selectedLead ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <InboxIcon className="h-12 w-12 mb-2" />
                <p className="text-sm">Selecione uma conversa à esquerda</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-white border-b flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:hidden shrink-0 -ml-2"
                      onClick={() => setSelectedLead(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{selectedLead.name}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedLead.phone || selectedLead.email || "—"}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => router.push(`/leads?leadId=${selectedLead.id}`)}>
                    Ver Ficha
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {loadingThread ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                      Sem mensagens registadas com esta lead.
                    </div>
                  ) : (
                    thread
                      .slice()
                      .sort((a, b) => new Date(a.interaction_date).getTime() - new Date(b.interaction_date).getTime())
                      .map((msg) => {
                        if (msg.interaction_type === "email") {
                          return (
                            <div key={msg.id} className="self-center bg-white border rounded-lg px-3 py-1.5 text-xs text-gray-600 flex items-center gap-1.5 my-1">
                              <Mail className="h-3 w-3 text-blue-500" />
                              Email: {msg.subject || cleanContent(msg.content).slice(0, 60)}
                              <span className="text-gray-400">· {relativeTime(msg.interaction_date)}</span>
                            </div>
                          );
                        }
                        const isInbound = msg.interaction_type === "whatsapp_inbound";
                        return (
                          <div
                            key={msg.id}
                            className={`max-w-[75%] p-2.5 rounded-lg shadow-sm ${
                              isInbound ? "bg-white self-start rounded-tl-none" : "bg-[#dcf8c6] self-end rounded-tr-none"
                            }`}
                          >
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{cleanContent(msg.content)}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-gray-500">
                                {new Date(msg.interaction_date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="p-3 bg-white border-t flex gap-2">
                  {snippets.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={isSending} title="Inserir resposta rápida">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuLabel>Respostas rápidas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {snippets.map((snippet) => (
                          <DropdownMenuItem key={snippet.id} onClick={() => insertSnippet(snippet)}>
                            {snippet.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escreva uma resposta de WhatsApp..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleReply();
                    }}
                    disabled={isSending}
                  />
                  <Button onClick={handleReply} disabled={isSending || !replyText.trim()} className="bg-green-600 hover:bg-green-700">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 px-3 pb-2 bg-white">
                  As respostas só podem ser enviadas por WhatsApp. Emails só ficam visíveis aqui como referência — não há receção de respostas por email nesta caixa.
                </p>
              </>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
