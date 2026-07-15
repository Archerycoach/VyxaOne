import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Loader2, RotateCcw, Save, Send, ExternalLink } from "lucide-react";
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

interface TestResult {
  to: string;
  subject: string;
  optInUrl: string;
  optOutUrl: string;
  note?: string;
}

const ATTEMPT_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "1ª — Inicial" },
  { value: 2, label: "2ª — Lembrete" },
  { value: 3, label: "3ª — Final" },
];

export function ReactivationTemplatesManagement() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<ReactivationTemplateName, TemplateState>>({
    optin_inicial: { ...EMPTY_STATE },
    optin_lembrete_2: { ...EMPTY_STATE },
    optin_lembrete_final: { ...EMPTY_STATE },
  });

  // Painel de teste de envios
  const [testEmail, setTestEmail] = useState("");
  const [testAttempt, setTestAttempt] = useState<1 | 2 | 3>(1);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

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
      if (user.email) setTestEmail(user.email);
      await loadAll(user.id);
    };
    init();
  }, []);

  const handleTestSend = async () => {
    const email = testEmail.trim();
    if (!email) {
      toast({ title: "Indique o email da lead de teste", variant: "destructive" });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Volte a entrar.");

      const res = await fetch("/api/reactivation/test-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, attemptNumber: testAttempt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao enviar o email de teste.");

      // Envio suprimido de propósito (opt-out / não-contactar): avisar, não tratar como sucesso.
      if (data.suppressed) {
        toast({
          title: "Envio suprimido",
          description: data.message || "Esta lead está excluída das listas de distribuição.",
          variant: "destructive",
        });
        return;
      }

      setTestResult({
        to: data.to,
        subject: data.subject,
        optInUrl: data.optInUrl,
        optOutUrl: data.optOutUrl,
        note: data.note,
      });
      toast({
        title: "✅ Email de teste enviado",
        description: `Enviado para ${data.to}. Verifique a caixa de entrada e teste os links.`,
      });
    } catch (error: any) {
      toast({ title: "Erro ao enviar teste", description: error.message, variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

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
    <div className="space-y-6">
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

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" /> Testar Envio
        </CardTitle>
        <CardDescription>
          Envia o email de reativação real (mesmo template e mesmos links) para uma lead sua de teste,
          <strong> sem alterar o estado da lead</strong>. Dica: crie uma lead com o seu próprio email e teste aqui —
          depois pode clicar nos links recebidos para validar o opt-in e o unsubscribe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="test-email" className="text-xs">Email da lead de teste</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="lead-teste@exemplo.pt"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tentativa / template</Label>
            <div className="flex gap-2">
              {ATTEMPT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={testAttempt === opt.value ? "default" : "outline"}
                  onClick={() => setTestAttempt(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={handleTestSend} disabled={testSending}>
          {testSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar email de teste
        </Button>

        {testResult && (
          <div className="border rounded-md p-3 text-sm space-y-2 bg-gray-50">
            <p><span className="font-medium">Enviado para:</span> {testResult.to}</p>
            <p><span className="font-medium">Assunto:</span> {testResult.subject}</p>
            {testResult.note && <p className="text-amber-700">{testResult.note}</p>}
            <div className="flex flex-col gap-1 pt-1">
              <a
                href={testResult.optInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Link de opt-in
              </a>
              <a
                href={testResult.optOutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Link de unsubscribe
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
