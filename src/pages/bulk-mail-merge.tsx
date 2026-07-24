import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  Users,
  FileSpreadsheet,
  Sparkles,
  Paperclip,
  X,
} from "lucide-react";
import { getCurrentUser } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";
import { BulkCampaignsReport } from "@/components/bulk/BulkCampaignsReport";
import { toast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { collapseEmptyBlocks } from "@/lib/emailSignatureFormat";
import { parseExcelFile } from "@/services/importService";
import { normalizeVarToken } from "@/lib/mailMergeVars";

/**
 * Mensagens em massa (mala-direta por Excel/CSV).
 *
 * Modelo Word > Excel > Outlook: carrega-se uma lista, cada coluna vira uma
 * variável {token}, a IA pode escrever o email (com público-alvo/idioma e um
 * link/brochura como base), e o envio personaliza linha a linha. Os
 * destinatários são efémeros — não entram no CRM.
 */

type MergeRecipient = {
  id: string;
  name: string;
  email: string;
  vars: Record<string, string>;
};

export default function BulkMailMerge() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sending, setSending] = useState(false);

  // Lista carregada.
  const [sheetRows, setSheetRows] = useState<Array<Record<string, any>>>([]);
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const [sheetEmailCol, setSheetEmailCol] = useState<string>("");
  const [sheetNameCol, setSheetNameCol] = useState<string>("");
  const [sheetFileName, setSheetFileName] = useState<string>("");
  const [parsingSheet, setParsingSheet] = useState(false);

  // Seleção e pesquisa.
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Mensagem.
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: number; base64: string }[]>([]);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);
  const copyEmail = user?.email || "";

  // Assinatura (só pré-visualização — o servidor acrescenta a real no envio).
  const [userSignature, setUserSignature] = useState<{ text: string | null; image: string | null }>({
    text: null,
    image: null,
  });

  // Escrita por IA.
  const [aiComposeOpen, setAiComposeOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiComposing, setAiComposing] = useState(false);
  const [aiSourceUrl, setAiSourceUrl] = useState("");
  const [aiSourceFile, setAiSourceFile] = useState<{ name: string; base64: string; size: number } | null>(null);
  // Escolher incluir no email: o link de reserva de conversa e/ou o link/brochura.
  const [aiIncludeBooking, setAiIncludeBooking] = useState(false);
  const [aiIncludeSource, setAiIncludeSource] = useState(false);

  useEffect(() => {
    (async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email_signature_text, email_signature_image_url")
        .eq("id", user.id)
        .single();
      if (profile) {
        setUserSignature({ text: profile.email_signature_text, image: profile.email_signature_image_url });
      }
    })();
  }, [user]);

  // ── Lista (Excel/CSV) ──────────────────────────────────────────────────────
  const sheetVarTokens = useMemo(
    () => Array.from(new Set(sheetColumns.map((c) => normalizeVarToken(c)).filter(Boolean))),
    [sheetColumns],
  );

  const buildSheetRecipients = (): MergeRecipient[] => {
    if (!sheetEmailCol) return [];
    const seen = new Set<string>();
    const out: MergeRecipient[] = [];
    sheetRows.forEach((row, idx) => {
      const email = String(row[sheetEmailCol] ?? "").trim();
      if (!email || seen.has(email.toLowerCase())) return;
      seen.add(email.toLowerCase());
      const name = (sheetNameCol ? String(row[sheetNameCol] ?? "").trim() : "") || email.split("@")[0];
      const vars: Record<string, string> = {};
      for (const col of sheetColumns) {
        vars[normalizeVarToken(col)] = row[col] == null ? "" : String(row[col]);
      }
      vars.nome = name;
      vars.email = email;
      out.push({ id: `sheet-${idx}`, name, email, vars });
    });
    return out;
  };

  // Lista completa (só recalcula quando a lista/mapeamento muda). A pesquisa
  // filtra por cima, sem reconstruir tudo a cada tecla.
  const allRecipients = useMemo(
    () => buildSheetRecipients(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetRows, sheetColumns, sheetEmailCol, sheetNameCol],
  );

  const recipients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return allRecipients;
    return allRecipients.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [allRecipients, searchQuery]);

  const handleSheetUpload = async (file: File) => {
    setParsingSheet(true);
    try {
      const rows = await parseExcelFile(file);
      const cleaned = (rows || []).filter((r) => r && typeof r === "object");
      if (cleaned.length === 0) {
        toast({ title: "Ficheiro vazio", description: "Não encontrei linhas com dados.", variant: "destructive" });
        return;
      }
      const cols = Array.from(new Set(cleaned.flatMap((r) => Object.keys(r))));
      setSheetRows(cleaned);
      setSheetColumns(cols);
      setSheetFileName(file.name);
      const emailCol = cols.find((c) => /e-?mail/i.test(c)) || "";
      const nameCol = cols.find((c) => /(nome|name)/i.test(c)) || "";
      setSheetEmailCol(emailCol);
      setSheetNameCol(nameCol);
      if (!emailCol) {
        toast({ title: "Indique a coluna do email", description: "Não detetei a coluna de email — escolha-a abaixo." });
      }
    } catch (error: any) {
      toast({ title: "Erro ao ler o ficheiro", description: error?.message || "Formato não suportado.", variant: "destructive" });
    } finally {
      setParsingSheet(false);
    }
  };

  const clearSheet = () => {
    setSheetRows([]);
    setSheetColumns([]);
    setSheetEmailCol("");
    setSheetNameCol("");
    setSheetFileName("");
    setSelectedRecipients(new Set());
  };

  // Seleciona automaticamente todos os destinatários com email.
  useEffect(() => {
    setSelectedRecipients(new Set(allRecipients.map((r) => r.id)));
  }, [allRecipients]);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedRecipients(new Set(recipients.map((r) => r.id)));
  const deselectAll = () => setSelectedRecipients(new Set());

  // ── Anexos ─────────────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024;
    files.forEach((file) => {
      if (file.size > maxSize) {
        toast({ title: "Ficheiro demasiado grande", description: `${file.name} excede 10MB.`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachments((prev) => [...prev, { name: file.name, size: file.size, base64 }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const buildSignaturePreviewHtml = () => {
    if (!userSignature.text && !userSignature.image) return "";
    let sigHtml = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eaeaea;">';
    if (userSignature.text) sigHtml += collapseEmptyBlocks(userSignature.text);
    if (userSignature.image) {
      sigHtml += `<br><img src="${userSignature.image}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
    }
    sigHtml += "</div>";
    return sigHtml;
  };

  // ── Escrita por IA ──────────────────────────────────────────────────────────
  const handleAiSourceFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Ficheiro demasiado grande", description: "A brochura deve ter até 20 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setAiSourceFile({ name: file.name, base64, size: file.size });
    };
    reader.readAsDataURL(file);
  };

  const handleAiCompose = async () => {
    if (!aiBrief.trim() && !aiSourceFile && !aiSourceUrl.trim()) {
      toast({ title: "Falta o conteúdo", description: "Descreva o email ou forneça um link/brochura.", variant: "destructive" });
      return;
    }
    setAiComposing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      let sourceContent: string | null = null;
      if (aiSourceFile || aiSourceUrl.trim()) {
        const extractRes = await fetch("/api/gpt/properties/extract-listing-content", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(
            aiSourceFile
              ? { documentBase64: aiSourceFile.base64, documentName: aiSourceFile.name }
              : { sourceUrl: aiSourceUrl.trim() },
          ),
        });
        const extractData = await extractRes.json();
        if (!extractRes.ok || !extractData.text) {
          throw new Error(extractData.error || "Não consegui ler o link/brochura. Verifique e tente de novo.");
        }
        sourceContent = extractData.text;
      }

      // Link de reserva de conversa a incluir como CTA (se pedido).
      let bookingUrl: string | null = null;
      if (aiIncludeBooking) {
        const { getOrCreateBookingLink } = await import("@/services/bookingService");
        bookingUrl = await getOrCreateBookingLink();
      }

      // Link do imóvel a incluir no email (só quando a base é um link e o
      // consultor escolheu incluí-lo). A brochura, sendo ficheiro, vai como
      // anexo (ver abaixo) em vez de link.
      const propertyUrl = aiIncludeSource && aiSourceUrl.trim() ? aiSourceUrl.trim() : null;

      const variables = Array.from(new Set([...sheetVarTokens, "nome", "email"]));
      const sample: Record<string, string> = {};
      if (sheetRows[0]) {
        for (const col of sheetColumns) sample[normalizeVarToken(col)] = String(sheetRows[0][col] ?? "");
      }
      const res = await fetch("/api/gpt/emails/compose-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ brief: aiBrief, audience: aiAudience, variables, sample, sourceContent, bookingUrl, propertyUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.subject) throw new Error(data.error || "Falha ao escrever o email.");
      setSubject(data.subject);
      setMessage(data.html || "");

      // Brochura escolhida para incluir no email → segue como anexo.
      if (aiIncludeSource && aiSourceFile) {
        setAttachments((prev) =>
          prev.some((a) => a.name === aiSourceFile.name)
            ? prev
            : [...prev, { name: aiSourceFile.name, size: aiSourceFile.size, base64: aiSourceFile.base64 }],
        );
      }

      setAiComposeOpen(false);
      setAiBrief("");
      setAiAudience("");
      setAiSourceUrl("");
      setAiSourceFile(null);
      setAiIncludeBooking(false);
      setAiIncludeSource(false);
      toast({ title: "Email escrito pela IA", description: "Revê e ajusta antes de enviar." });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível escrever o email.", variant: "destructive" });
    } finally {
      setAiComposing(false);
    }
  };

  // ── Envio ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    // Envia a TODOS os selecionados, mesmo os que a pesquisa esteja a esconder.
    const selectedData = allRecipients.filter((r) => selectedRecipients.has(r.id));
    if (selectedData.length === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um destinatário.", variant: "destructive" });
      return;
    }
    const cleanMsg = message.replace(/<[^>]*>?/gm, "").trim();
    if (!message.trim() || (!cleanMsg && !message.includes("<img"))) {
      toast({ title: "Aviso", description: "A mensagem não pode estar vazia.", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Aviso", description: "O assunto não pode estar vazio.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      // Envio em SEGUNDO PLANO: enfileira e devolve logo — o worker no servidor
      // envia gradualmente, mesmo que o utilizador saia da página.
      const res = await fetch("/api/bulk-email/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          subject,
          html: message,
          attachments: attachments.map((att) => ({ filename: att.name, content: att.base64, encoding: "base64" })),
          sendCopyToSender: sendCopyToSelf && Boolean(copyEmail),
          audienceSource: "sheet_merge",
          criteria: { file: sheetFileName, rows: sheetRows.length },
          recipients: selectedData.map((r) => ({ email: r.email, name: r.name, vars: r.vars })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Não foi possível iniciar o envio.");

      toast({
        title: "Envio iniciado em segundo plano",
        description: `${data.queued} email(s) na fila. Pode continuar a trabalhar — acompanhe o progresso no histórico acima.`,
      });

      // Limpa o formulário; o histórico passa a refletir o progresso.
      setSubject("");
      setMessage("");
      setAttachments([]);
      setSelectedRecipients(new Set());
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao iniciar o envio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">A verificar autenticação...</p>
      </div>
    );
  }

  return (
    <Layout title="Mensagens em massa">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Mensagens em massa</h1>
            <p className="text-gray-600 mt-1">
              Mala-direta por email a partir de uma lista Excel/CSV — cada coluna vira uma variável, e a IA pode escrever o texto.
            </p>
          </div>

          <div className="mb-6">
            <BulkCampaignsReport title="Histórico de envios" defaultOpen sourceFilter="sheet_merge" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de destinatários */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Destinatários
                  </CardTitle>
                  <CardDescription>
                    {selectedRecipients.size} de {recipients.length} selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3">
                    {sheetRows.length === 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" /> Carregar lista
                        </Label>
                        <Input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          disabled={parsingSheet}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleSheetUpload(f);
                            e.target.value = "";
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Cada coluna fica disponível como variável (ex.: {"{primeiro_nome}"}). Os contactos são usados só
                          neste envio e não entram no CRM. Garanta que tem consentimento para contactar esta lista.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{sheetFileName}</span>
                          </p>
                          <Button variant="ghost" size="icon" onClick={clearSheet} title="Remover lista">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{sheetRows.length} linha(s) no ficheiro.</p>
                        <div className="space-y-1">
                          <Label className="text-xs">Coluna do email *</Label>
                          <Select value={sheetEmailCol} onValueChange={setSheetEmailCol}>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolher coluna..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sheetColumns.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Coluna do nome</Label>
                          <Select
                            value={sheetNameCol || "__none"}
                            onValueChange={(v) => setSheetNameCol(v === "__none" ? "" : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="(opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">(nenhuma)</SelectItem>
                              {sheetColumns.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    placeholder="Pesquisar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">
                      Selecionar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll} className="flex-1">
                      Limpar
                    </Button>
                  </div>

                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    {recipients.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Nenhum destinatário</p>
                        <p className="text-sm mt-1">Carregue uma lista e indique a coluna do email.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recipients.map((recipient) => (
                          <div
                            key={recipient.id}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleRecipient(recipient.id)}
                          >
                            <Checkbox
                              checked={selectedRecipients.has(recipient.id)}
                              onCheckedChange={() => toggleRecipient(recipient.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{recipient.name}</p>
                              <p className="text-xs text-gray-500 truncate">{recipient.email}</p>
                              <Badge variant="outline" className="text-xs mt-1">Lista</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Compositor */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compor Email</CardTitle>
                  <CardDescription>
                    Escreva o email ou peça à IA. Use {"{coluna}"} para inserir variáveis da lista.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">Variáveis da lista</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAiComposeOpen(true)}
                        disabled={sheetVarTokens.length === 0}
                      >
                        <Sparkles className="h-4 w-4 mr-2 text-amber-500" /> Escrever com IA
                      </Button>
                    </div>
                    {sheetVarTokens.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {["nome", ...sheetVarTokens.filter((t) => t !== "nome" && t !== "email")].map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="text-xs rounded border bg-white px-2 py-0.5 hover:bg-slate-100"
                            onClick={() => setMessage((m) => `${m || ""}{${t}}`)}
                            title="Inserir variável no fim da mensagem"
                          >
                            {`{${t}}`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Carregue uma lista à esquerda para ver as variáveis disponíveis.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Assunto *</Label>
                    <Input
                      id="subject"
                      placeholder="Assunto do email..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-message">Mensagem *</Label>
                    <div className="border rounded-md overflow-hidden">
                      <RichTextEditor value={message} onChange={setMessage} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cada destinatário recebe os seus valores nas variáveis {"{coluna}"}. A sua assinatura é acrescentada
                      automaticamente no envio.
                    </p>
                  </div>

                  {(userSignature.text || userSignature.image) && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-gray-500 mb-2">A sua assinatura será adicionada automaticamente ao enviar:</p>
                      <div
                        className="text-sm prose prose-sm max-w-none pointer-events-none select-none opacity-90"
                        dangerouslySetInnerHTML={{ __html: buildSignaturePreviewHtml() }}
                      />
                    </div>
                  )}

                  <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <Checkbox
                      id="send-copy-to-self"
                      checked={sendCopyToSelf}
                      onCheckedChange={(checked) => setSendCopyToSelf(checked === true)}
                      disabled={!copyEmail}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="send-copy-to-self" className="cursor-pointer">Receber uma cópia do email enviado</Label>
                      <p className="text-xs text-gray-500">
                        {copyEmail ? `Será enviada uma cópia para ${copyEmail}.` : "Sem email disponível para a cópia."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label>Anexos</Label>
                      <Label htmlFor="file-upload" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Paperclip className="h-4 w-4" /> Adicionar Ficheiro
                      </Label>
                      <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
                    </div>
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {attachments.map((att, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-2 font-normal">
                            <Paperclip className="h-3 w-3 text-gray-500" />
                            <span className="truncate max-w-[150px]">{att.name}</span>
                            <span className="text-xs text-gray-500">({(att.size / 1024).toFixed(0)}KB)</span>
                            <button onClick={() => removeAttachment(index)} className="ml-1 text-gray-500 hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSend}
                      disabled={sending || selectedRecipients.size === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> A Enviar...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" /> Enviar para {selectedRecipients.size}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Escrever com IA */}
      <Dialog open={aiComposeOpen} onOpenChange={setAiComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escrever email com IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-brief">O que quer comunicar?</Label>
              <Textarea
                id="ai-brief"
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                placeholder="Ex.: Convidar para a angariação de um T3 em Alvalade, com visita no próximo sábado."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-audience">Público-alvo, tom e idioma (opcional)</Label>
              <Input
                id="ai-audience"
                value={aiAudience}
                onChange={(e) => setAiAudience(e.target.value)}
                placeholder="Ex.: investidores estrangeiros, em inglês, tom formal"
              />
              <p className="text-xs text-muted-foreground">A IA adapta o texto e escreve no idioma que indicar aqui.</p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={aiIncludeBooking}
                onCheckedChange={(c) => setAiIncludeBooking(c === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Incluir link de reserva de conversa
                <span className="block text-xs text-muted-foreground">
                  A IA acrescenta um convite para o destinatário marcar uma conversa consigo.
                </span>
              </span>
            </label>

            <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
              <Label className="text-sm">Link do imóvel ou brochura (opcional)</Label>
              <Input
                type="url"
                value={aiSourceUrl}
                onChange={(e) => setAiSourceUrl(e.target.value)}
                placeholder="Colar um link (ex.: anúncio do imóvel)"
                disabled={!!aiSourceFile}
              />
              <div className="text-xs text-muted-foreground text-center">ou</div>
              {aiSourceFile ? (
                <div className="flex items-center justify-between gap-2 rounded border bg-white px-2 py-1">
                  <span className="text-sm truncate flex items-center gap-2">
                    <Paperclip className="h-4 w-4 shrink-0" /> {aiSourceFile.name}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setAiSourceFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept=".pdf,.docx"
                  disabled={!!aiSourceUrl.trim()}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAiSourceFile(f);
                    e.target.value = "";
                  }}
                />
              )}
              <p className="text-xs text-muted-foreground">
                A IA lê o link ou a brochura (PDF/Word) e escreve com base nesses factos.
              </p>
              {(aiSourceUrl.trim() || aiSourceFile) && (
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <Checkbox
                    checked={aiIncludeSource}
                    onCheckedChange={(c) => setAiIncludeSource(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    Incluir também no email
                    <span className="block text-xs text-muted-foreground">
                      {aiSourceFile ? "A brochura vai como anexo do email." : "O link do imóvel é incluído no texto."}
                    </span>
                  </span>
                </label>
              )}
            </div>

            {sheetVarTokens.length > 0 && (
              <p className="text-xs text-muted-foreground">
                A IA vai usar as variáveis da lista onde fizerem sentido:{" "}
                {["nome", ...sheetVarTokens.filter((t) => t !== "nome" && t !== "email")].map((t) => `{${t}}`).join(", ")}.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiComposeOpen(false)} disabled={aiComposing}>
              Cancelar
            </Button>
            <Button
              onClick={handleAiCompose}
              disabled={aiComposing || (!aiBrief.trim() && !aiSourceFile && !aiSourceUrl.trim())}
            >
              {aiComposing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Escrever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
