import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Check, X, Undo2, Loader2, Inbox, History, Thermometer,
  ListChecks, CalendarDays, ClipboardList,
} from "lucide-react";
import { getAiActions, decideAiActions, type AiActionItem } from "@/services/aiActionsService";

const CAPABILITY_META: Record<string, { label: string; icon: typeof Thermometer }> = {
  lead_qualification: { label: "Qualificação", icon: ClipboardList },
  lead_temperature: { label: "Temperatura", icon: Thermometer },
  lead_status: { label: "Fase", icon: ListChecks },
  task_create: { label: "Tarefa", icon: ListChecks },
  calendar_block: { label: "Agenda", icon: CalendarDays },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovada", className: "bg-green-100 text-green-800" },
  auto_applied: { label: "Automática", className: "bg-blue-100 text-blue-800" },
  rejected: { label: "Rejeitada", className: "bg-gray-100 text-gray-700" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-800" },
  reverted: { label: "Revertida", className: "bg-amber-100 text-amber-800" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function AiInboxPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [actions, setActions] = useState<AiActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (scope: "pending" | "history") => {
    setLoading(true);
    try {
      setActions(await getAiActions(scope));
    } catch (error) {
      toast({
        title: "Erro ao carregar",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const decide = async (ids: string[], decision: "approve" | "reject" | "revert") => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { succeeded, total } = await decideAiActions(ids, decision);
      const verb =
        decision === "approve" ? "aplicada(s)" : decision === "reject" ? "rejeitada(s)" : "revertida(s)";
      toast({
        title: `${succeeded} de ${total} ${verb}`,
        description: succeeded < total ? "Algumas não puderam ser processadas." : undefined,
      });
      await load(tab);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const pendingIds = actions.filter((a) => a.status === "pending").map((a) => a.id);

  return (
    <ProtectedRoute>
      <SEO title="Assistente IA" description="Aprova e audita o que a IA faz por ti." />
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Sparkles className="h-6 w-6 text-purple-600" />
                Assistente IA
              </h1>
              <p className="text-sm text-muted-foreground">
                O que a IA fez por ti e o que está à espera de aprovação. Tudo fica registado e
                pode ser desfeito.
              </p>
            </div>

            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                variant={tab === "pending" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("pending")}
              >
                <Inbox className="mr-2 h-4 w-4" />
                Por aprovar
              </Button>
              <Button
                variant={tab === "history" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("history")}
              >
                <History className="mr-2 h-4 w-4" />
                Registo
              </Button>
            </div>
          </div>

          {tab === "pending" && pendingIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => decide(pendingIds, "approve")} disabled={busy}>
                <Check className="mr-2 h-4 w-4" />
                Aprovar todas ({pendingIds.length})
              </Button>
              <Button variant="outline" onClick={() => decide(pendingIds, "reject")} disabled={busy}>
                <X className="mr-2 h-4 w-4" />
                Rejeitar todas
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              A carregar…
            </div>
          ) : actions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                {tab === "pending"
                  ? "Nada à espera de aprovação. A IA avisa-te quando tiver algo para propor."
                  : "Ainda não há registo de ações da IA."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => {
                const meta = CAPABILITY_META[action.capability] || {
                  label: action.capability,
                  icon: Sparkles,
                };
                const Icon = meta.icon;
                const statusMeta = STATUS_META[action.status];

                return (
                  <Card key={action.id}>
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                          {statusMeta && (
                            <Badge className={statusMeta.className} variant="outline">
                              {statusMeta.label}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(action.created_at)}
                          </span>
                        </div>

                        <p className="font-medium">{action.title}</p>

                        {action.reason && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {action.reason}
                          </p>
                        )}

                        {action.error && (
                          <p className="mt-1 text-sm text-red-600">Erro: {action.error}</p>
                        )}

                        {action.lead_id && (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => router.push(`/leads?leadId=${action.lead_id}`)}
                          >
                            Ver lead{action.leads?.name ? `: ${action.leads.name}` : ""}
                          </Button>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        {action.status === "pending" ? (
                          <>
                            <Button size="sm" onClick={() => decide([action.id], "approve")} disabled={busy}>
                              <Check className="mr-1 h-4 w-4" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decide([action.id], "reject")}
                              disabled={busy}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          (action.status === "approved" || action.status === "auto_applied") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decide([action.id], "revert")}
                              disabled={busy}
                              title="Repor o valor anterior"
                            >
                              <Undo2 className="mr-1 h-4 w-4" />
                              Desfazer
                            </Button>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
