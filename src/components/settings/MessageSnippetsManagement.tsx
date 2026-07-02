import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type MessageSnippet,
  getMessageSnippets,
  createMessageSnippet,
  updateMessageSnippet,
  deleteMessageSnippet,
} from "@/services/messageSnippetsService";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  both: "Email + WhatsApp",
};

export function MessageSnippetsManagement() {
  const { toast } = useToast();
  const [snippets, setSnippets] = useState<MessageSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<MessageSnippet | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">("both");
  const [saving, setSaving] = useState(false);

  const loadSnippets = async () => {
    setLoading(true);
    try {
      const data = await getMessageSnippets();
      setSnippets(data);
    } catch (error: any) {
      toast({ title: "Erro ao carregar respostas rápidas", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  const openNewDialog = () => {
    setEditingSnippet(null);
    setTitle("");
    setContent("");
    setChannel("both");
    setDialogOpen(true);
  };

  const openEditDialog = (snippet: MessageSnippet) => {
    setEditingSnippet(snippet);
    setTitle(snippet.title);
    setContent(snippet.content);
    setChannel(snippet.channel);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Preencha o título e o texto", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingSnippet) {
        await updateMessageSnippet(editingSnippet.id, { title: title.trim(), content: content.trim(), channel });
        toast({ title: "Resposta rápida atualizada" });
      } else {
        await createMessageSnippet({ title: title.trim(), content: content.trim(), channel });
        toast({ title: "Resposta rápida criada" });
      }
      setDialogOpen(false);
      loadSnippets();
    } catch (error: any) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar esta resposta rápida?")) return;
    try {
      await deleteMessageSnippet(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Resposta rápida apagada" });
    } catch (error: any) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Respostas Rápidas</CardTitle>
          <CardDescription>
            Modelos fixos para perguntas repetitivas (ex.: "Qual a comissão?"), inseridos com um clique no
            WhatsApp e no email — sem passar pela IA. Suporta {"{nome}"}, {"{email}"}, {"{telefone}"} e{" "}
            {"{empreendimento}"}.
          </CardDescription>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Resposta
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Ainda não tem respostas rápidas guardadas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snippets.map((snippet) => (
              <div key={snippet.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{snippet.title}</p>
                    <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[snippet.channel]}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{snippet.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(snippet)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(snippet.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSnippet ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="snippet-title">Título (só para si reconhecer na lista)</Label>
              <Input
                id="snippet-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Comissão"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snippet-content">Texto</Label>
              <Textarea
                id="snippet-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ex.: Olá {nome}, a nossa comissão é de..."
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Onde aparece</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Email + WhatsApp</SelectItem>
                  <SelectItem value="email">Só Email</SelectItem>
                  <SelectItem value="whatsapp">Só WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
