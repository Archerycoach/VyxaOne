import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronDown, ChevronUp, Mail, AlertTriangle } from "lucide-react";
import { getCampaigns, type BulkEmailCampaign } from "@/services/bulkCampaignsService";

/** Descreve os critérios de procura numa frase curta ("Lisboa • T2"). */
function describeCriteria(criteria: Record<string, any>): string {
  const parts = [criteria?.location, criteria?.typology, criteria?.propertyType, criteria?.buyPurpose]
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  return parts.join(" • ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Histórico de envios em massa: quantos emails saíram mesmo em cada campanha.
 *
 * O envio mostrava o resultado num toast que desaparecia — depois disso não
 * havia forma de saber se uma campanha de centenas de emails tinha chegado ao
 * fim ou parado a meio.
 */
export function BulkCampaignsReport({
  title = "Histórico de envios",
  defaultOpen = false,
  sourceFilter,
}: {
  title?: string;
  /** Abre o histórico logo ao carregar a página (em vez de ficar recolhido). */
  defaultOpen?: boolean;
  /** Mostra só as campanhas desta origem (ex.: "sheet_merge" na mala-direta). */
  sourceFilter?: string;
} = {}) {
  const [campaigns, setCampaigns] = useState<BulkEmailCampaign[]>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getCampaigns(50, sourceFilter)
      .then(setCampaigns)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceFilter]);

  // Enquanto houver uma campanha a enviar em segundo plano, refresca sozinho
  // para o progresso subir à vista, sem o utilizador ter de carregar em Atualizar.
  const hasInProgress = campaigns.some(
    (c) => !c.finished_at && (c.status === "queued" || c.status === "processing"),
  );
  useEffect(() => {
    if (!open || !hasInProgress) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasInProgress, sourceFilter]);

  return (
    <Card className="p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex items-center gap-2 font-semibold text-gray-900">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">A carregar...</p>}

          {!loading && campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há envios registados. As campanhas passam a aparecer aqui a partir do próximo envio.
            </p>
          )}

          {campaigns.map((campaign) => {
            const criteria = describeCriteria(campaign.criteria || {});
            const inProgress = !campaign.finished_at && (campaign.status === "queued" || campaign.status === "processing");
            // "Interrompido" só se ETIQUETA de conclusão em falta E não está em
            // curso (campanhas antigas enviadas no browser que pararam a meio).
            const interrupted = !campaign.finished_at && !inProgress;
            const missing = campaign.recipients_total - campaign.sent_count - campaign.failed_count;

            return (
              <div key={campaign.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {campaign.subject || "(sem assunto)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(campaign.created_at)}
                      {criteria ? ` • ${criteria}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {campaign.audience_source === "ai_search" && (
                      <Badge variant="secondary">Emails por procura</Badge>
                    )}
                    {campaign.audience_source === "sheet_merge" && (
                      <Badge variant="secondary">Mala-direta</Badge>
                    )}
                    {inProgress && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">A enviar…</Badge>
                    )}
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <Mail className="mr-1 h-3 w-3" />
                      {campaign.sent_count} enviados
                    </Badge>
                    {campaign.failed_count > 0 && (
                      <Badge variant="destructive">{campaign.failed_count} falharam</Badge>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {campaign.recipients_total} destinatários selecionados
                </p>

                {inProgress && (
                  <p className="mt-2 text-xs text-blue-700">
                    A enviar em segundo plano — {campaign.sent_count + campaign.failed_count} de{" "}
                    {campaign.recipients_total} processados.
                  </p>
                )}

                {/* Uma campanha interrompida deixa destinatários por contactar
                    sem qualquer erro associado — vale a pena dizê-lo. */}
                {interrupted && missing > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Envio interrompido — {missing} destinatários não chegaram a receber.
                  </p>
                )}

                {campaign.errors?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Ver erros ({campaign.errors.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                      {campaign.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}

          {campaigns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={load}>
              Atualizar
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
