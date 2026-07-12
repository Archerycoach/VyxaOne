import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMyFormQuestions,
  createFormQuestion,
  deleteFormQuestion,
  type FormQuestion,
  type FormType,
  type FieldType,
} from "@/services/formQuestionsService";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  phone: "Telefone",
  select: "Escolha (lista)",
};

function FormTypeSection({ formType, title, description }: { formType: FormType; title: string; description: string }) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setQuestions(await getMyFormQuestions(formType));
    } catch (err) {
      console.error("[FormQuestions] load:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!label.trim()) {
      toast({ title: "Indique o texto da pergunta", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await createFormQuestion({
        form_type: formType,
        label: label.trim(),
        field_type: fieldType,
        required,
        options: fieldType === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [],
        sort_order: questions.length,
      });
      setLabel("");
      setFieldType("text");
      setRequired(false);
      setOptionsText("");
      await load();
      toast({ title: "Pergunta adicionada" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFormQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar...</div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem perguntas personalizadas. Os campos base (nome, email, telefone, mensagem) aparecem sempre.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <span className="font-medium">{q.label}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">{FIELD_TYPE_LABELS[q.field_type]}</Badge>
                  {q.required && <Badge variant="outline" className="text-xs">Obrigatória</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(q.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar nova pergunta */}
      <div className="rounded-md border bg-slate-50 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Texto da pergunta</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Qual o seu orçamento?" />
          </div>
          <div className="space-y-1">
            <Label>Tipo de resposta</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {fieldType === "select" && (
          <div className="space-y-1">
            <Label>Opções (separadas por vírgula)</Label>
            <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Ex: Até 200k, 200k-400k, Mais de 400k" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={required} onCheckedChange={setRequired} />
            Resposta obrigatória
          </label>
          <Button size="sm" onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Adicionar pergunta
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FormQuestionsSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          Perguntas dos Formulários
        </CardTitle>
        <CardDescription>
          Adicione perguntas personalizadas aos formulários públicos. As respostas ficam guardadas na lead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormTypeSection
          formType="landing"
          title="Formulário de contacto (landing pages)"
          description="Perguntas mostradas no formulário “Tenho interesse” das landing pages dos seus imóveis."
        />
        <div className="border-t" />
        <FormTypeSection
          formType="booking"
          title="Formulário de reserva (agendamento)"
          description="Perguntas mostradas quando alguém marca uma chamada pelo seu link de agendamento."
        />
      </CardContent>
    </Card>
  );
}
