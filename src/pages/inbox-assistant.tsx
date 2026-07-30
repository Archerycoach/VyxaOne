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
import { Mail, Loader2, CheckCircle, X, User, Flame, Ban, Plus, RefreshCw } from "lucide-react";
import {
  getInboxTriage,
  setTriageStatus,
  getIgnoreSenders,
  setIgnoreSenders,
  runInboxNow,
  type InboxTriageItem,
} from "@/services/inboxAssistantService";

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

  const load = async () => {
    try {
      const [triage, ignored] = await Promise.all([getInboxTriage(), getIgnoreSenders()]);
      setItems(triage);
      setIgnoreList(ignored);
    } finally {
      setLoading(false);
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
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                            {item.from_name && (
                              <span className="text-xs text-muted-foreground">de {item.from_name}</span>
                            )}
                            {item.lead_id && (
                              <Badge variant="outline" className="gap-1 text-indigo-700 border-indigo-200 bg-indigo-50">
                                <Flame className="h-3 w-3" /> Lead
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
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {item.lead_id && (
                          <Button variant="outline" size="sm" onClick={() => router.push(`/leads?leadId=${item.lead_id}`)}>
                            <User className="h-4 w-4 mr-1.5" /> Abrir lead
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(item, "handled")}>
                          <CheckCircle className="h-4 w-4 mr-1.5 text-green-600" /> Tratado
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(item, "dismissed")}>
                          <X className="h-4 w-4 mr-1.5 text-gray-500" /> Ignorar
                        </Button>
                      </div>
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
