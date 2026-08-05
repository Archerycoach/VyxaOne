import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Trash2, RefreshCw, Loader2, FileText, Upload, Search, Building2, User,
} from "lucide-react";
import {
  getKnowledgeDocs, createKnowledgeDoc, deleteKnowledgeDoc, reindexKnowledgeDoc,
  updateKnowledgeDoc, searchKnowledgeDocs, fileToBase64,
  type KnowledgeDoc, type KnowledgeMatch, type KnowledgeScope,
} from "@/services/knowledgeService";

const STATUS_META: Record<string, { label: string; className: string }> = {
  indexed: { label: "Indexado", className: "bg-green-100 text-green-700" },
  pending: { label: "Por indexar", className: "bg-amber-100 text-amber-700" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-700" },
};

const ACCEPTED = ".pdf,.docx,.txt,.md,.csv";

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBroker, setIsBroker] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Diálogo de criação
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<KnowledgeScope>("user");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Painel de teste
  const [query, setQuery] = useState("");
  const [testing, setTesting] = useState(false);
  const [matches, setMatches] = useState<KnowledgeMatch[] | null>(null);

  const load = async () => {
    try {
      setDocs(await getKnowledgeDocs());
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setIsBroker((profile as any)?.role === "broker");
      }
      await load();
    };
    init();
  }, []);

  const resetForm = () => {
    setTitle("");
    setScope("user");
    setText("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = async () => {
    if (!text.trim() && !file) {
      toast({ title: "Falta o conteúdo", description: "Cola o texto ou escolhe um ficheiro.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: any = { title: title.trim() || file?.name || "Documento", scope };

      if (file) {
        payload.fileBase64 = await fileToBase64(file);
        payload.fileName = file.name;
        payload.mimeType = file.type;
      } else {
        payload.text = text.trim();
      }

      const result = await createKnowledgeDoc(payload);

      if (result.status === "failed") {
        toast({
          title: "Documento guardado, mas por indexar",
          description: result.error || "Verifica a chave de IA nas Definições e usa o botão de reindexar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Documento adicionado",
          description: `${result.chunkCount} excertos indexados. A IA já o consulta.`,
        });
      }

      setOpen(false);
      resetForm();
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReindex = async (doc: KnowledgeDoc) => {
    setBusyId(doc.id);
    try {
      const { chunkCount } = await reindexKnowledgeDoc(doc.id);
      toast({ title: "Reindexado", description: `${chunkCount} excertos.` });
      await load();
    } catch (error: any) {
      toast({ title: "Não foi possível reindexar", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc: KnowledgeDoc) => {
    if (!window.confirm(`Apagar "${doc.title}"? A IA deixa de o consultar.`)) return;
    setBusyId(doc.id);
    try {
      await deleteKnowledgeDoc(doc.id);
      toast({ title: "Documento apagado" });
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleScope = async (doc: KnowledgeDoc) => {
    const next: KnowledgeScope = doc.scope === "agency" ? "user" : "agency";
    setBusyId(doc.id);
    try {
      await updateKnowledgeDoc(doc.id, { scope: next });
      toast({
        title: next === "agency" ? "Partilhado com a equipa" : "Passou a privado",
      });
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async () => {
    if (!query.trim()) return;
    setTesting(true);
    try {
      setMatches(await searchKnowledgeDocs(query.trim()));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const agencyDocs = docs.filter((d) => d.scope === "agency");
  const ownDocs = docs.filter((d) => d.scope === "user");

  const renderDoc = (doc: KnowledgeDoc) => {
    const status = STATUS_META[doc.status] || STATUS_META.pending;
    const canManage = doc.scope === "user" || isBroker;

    return (
      <Card key={doc.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{doc.title}</span>
                <Badge className={status.className}>{status.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {doc.chunk_count} excertos · {doc.char_count.toLocaleString("pt-PT")} caracteres
                {doc.file_name ? ` · ${doc.file_name}` : ""}
              </p>
              {doc.status === "failed" && doc.error ? (
                <p className="text-sm text-red-600 mt-1">{doc.error}</p>
              ) : null}
            </div>

            {canManage ? (
              <div className="flex items-center gap-1 shrink-0">
                {isBroker ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleScope(doc)}
                    disabled={busyId === doc.id}
                    title={doc.scope === "agency" ? "Passar a privado" : "Partilhar com a equipa"}
                  >
                    {doc.scope === "agency" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReindex(doc)}
                  disabled={busyId === doc.id}
                  title="Voltar a gerar os embeddings"
                >
                  {busyId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc)}
                  disabled={busyId === doc.id}
                  title="Apagar"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ProtectedRoute>
      <SEO title="Base de Conhecimento | Vyxa One" />
      <Layout>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6" />
                Base de Conhecimento
              </h1>
              <p className="text-muted-foreground mt-1">
                Documentos que a IA consulta antes de responder — argumentário, minutas,
                procedimentos, regras de comissões. Em vez de generalidades, responde com o teu método.
              </p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar documento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Adicionar à Base de Conhecimento</DialogTitle>
                  <DialogDescription>
                    Cola o texto ou envia um ficheiro (PDF, DOCX, TXT, MD). O texto é extraído e indexado; o ficheiro original não fica guardado.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="kb-title">Título</Label>
                    <Input
                      id="kb-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Guião de objeções — angariação"
                    />
                  </div>

                  {isBroker ? (
                    <div>
                      <Label>Âmbito</Label>
                      <Select value={scope} onValueChange={(v: KnowledgeScope) => setScope(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Só para mim</SelectItem>
                          <SelectItem value="agency">Toda a agência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor="kb-file">Ficheiro</Label>
                    <Input
                      id="kb-file"
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="kb-text">…ou cola o texto</Label>
                    <Textarea
                      id="kb-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      placeholder="Cola aqui o procedimento, o argumentário ou a minuta."
                      disabled={!!file}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {saving ? "A indexar…" : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Testar — ver exatamente o que a IA vai receber */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Testar</span>
                <span className="text-sm text-muted-foreground">
                  escreve uma pergunta e vê que excertos é que a IA vai receber
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTest();
                    }
                  }}
                  placeholder="Ex.: qual é a comissão numa angariação partilhada?"
                />
                <Button onClick={handleTest} disabled={testing || !query.trim()}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Procurar"}
                </Button>
              </div>

              {matches !== null ? (
                <div className="space-y-2">
                  {matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nada relevante. A IA responderá sem base de conhecimento a esta pergunta.
                    </p>
                  ) : (
                    matches.map((m, i) => (
                      <div key={`${m.doc_id}-${i}`} className="rounded-md border p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{m.scope === "agency" ? "Agência" : "Meu"}</Badge>
                          <span className="text-sm font-medium">{m.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {(m.similarity * 100).toFixed(0)}% relevante
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {agencyDocs.length > 0 ? (
                <div className="space-y-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Da agência ({agencyDocs.length})
                  </h2>
                  {agencyDocs.map(renderDoc)}
                </div>
              ) : null}

              <div className="space-y-2">
                <h2 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Meus documentos ({ownDocs.length})
                </h2>
                {ownDocs.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      Ainda não tens documentos. Começa pelo que repetes mais vezes: o guião de
                      objeções, o procedimento de angariação, a minuta de proposta.
                    </CardContent>
                  </Card>
                ) : (
                  ownDocs.map(renderDoc)
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
