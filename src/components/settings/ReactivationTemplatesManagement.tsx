import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  REACTIVATION_TEMPLATE_NAMES,
  REACTIVATION_TEMPLATE_LABELS,
  type ReactivationTemplateName,
  getReactivationTemplate,
  saveReactivationTemplate,
  resetReactivationTemplate,
} from "@/services/reactivationTemplateService";

interface TemplateState {
  subject: string;
  html_body: string;
  isCustomized: boolean;
  loading: boolean;
  saving: boolean;
}

const EMPTY_STATE: TemplateState = { subject: "", html_body: "", isCustomized: false, loading: true, saving: false };

export function ReactivationTemplatesManagement() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<ReactivationTemplateName, TemplateState>>({
    optin_inicial: { ...EMPTY_STATE },
    optin_lembrete_2: { ...EMPTY_STATE },
    optin_lembrete_final: { ...EMPTY_STATE },
  });

  const loadAll = async (uid: string) => {
    for (const name of REACTIVATION_TEMPLATE_NAMES) {
      try {
        const template = await getReactivationTemplate(name, uid);
        setTemplates((prev) => ({
          ...prev,
          [name]: {
            subject: template?.subject || "",
            html_body: template?.html_body || "",
            isCustomized: template?.isCustomized || false,
            loading: false,
            saving: false,
          },
        }));
      } catch (error) {
        console.error(`Erro ao carregar template ${name}:`, error);
        setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], loading: false } }));
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadAll(user.id);
    };
    init();
  }, []);

  const updateField = (name: ReactivationTemplateName, field: "subject" | "html_body", value: string) => {
    setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  const handleSave = async (name: ReactivationTemplateName) => {
    if (!userId) return;
    setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], saving: true } }));
    try {
      const t = templates[name];
      await saveReactivationTemplate(name, userId, t.subject, t.html_body);
      setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], isCustomized: true, saving: false } }));
      toast({ title: "✅ Texto guardado", description: "A sua versão personalizada vai ser usada a partir de agora." });
    } catch (error: any) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
      setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], saving: false } }));
    }
  };

  const handleReset = async (name: ReactivationTemplateName) => {
    if (!userId) return;
    if (!confirm("Repor para a predefinição partilhada? A sua versão personalizada será apagada.")) return;
    setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], saving: true } }));
    try {
      await resetReactivationTemplate(name, userId);
      const template = await getReactivationTemplate(name, userId);
      setTemplates((prev) => ({
        ...prev,
        [name]: {
          subject: template?.subject || "",
          html_body: template?.html_body || "",
          isCustomized: false,
          loading: false,
          saving: false,
        },
      }));
      toast({ title: "Reposto para a predefinição" });
    } catch (error: any) {
      toast({ title: "Erro ao repor", description: error.message, variant: "destructive" });
      setTemplates((prev) => ({ ...prev, [name]: { ...prev[name], saving: false } }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalizar Textos de Reativação</CardTitle>
        <CardDescription>
          Estes textos são partilhados por todos os consultores por defeito. Pode criar aqui a sua própria versão —
          só afeta os emails enviados a partir da sua conta. Variáveis disponíveis: {"{{nome}}"}, {"{{procura}}"},{" "}
          {"{{consultor}}"}, {"{{empresa}}"}, {"{{link_optin}}"}, {"{{link_unsubscribe}}"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {REACTIVATION_TEMPLATE_NAMES.map((name) => {
          const t = templates[name];
          return (
            <div key={name} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-medium text-sm">{REACTIVATION_TEMPLATE_LABELS[name]}</h4>
                <Badge
                  variant="outline"
                  className={t.isCustomized ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-600 border-gray-200"}
                >
                  {t.isCustomized ? "Personalizado" : "A usar predefinição partilhada"}
                </Badge>
              </div>

              {t.loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${name}-subject`} className="text-xs">Assunto</Label>
                    <Input
                      id={`${name}-subject`}
                      value={t.subject}
                      onChange={(e) => updateField(name, "subject", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mensagem</Label>
                    <div className="border rounded-md overflow-hidden">
                      <RichTextEditor
                        value={t.html_body}
                        onChange={(val) => updateField(name, "html_body", val)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={t.saving} onClick={() => handleSave(name)}>
                      {t.saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
                      Guardar a Minha Versão
                    </Button>
                    {t.isCustomized && (
                      <Button size="sm" variant="outline" disabled={t.saving} onClick={() => handleReset(name)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-2" />
                        Repor Predefinição
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
