import { supabase } from "@/integrations/supabase/client";

export interface BulkEmailCampaign {
  id: string;
  user_id: string;
  subject: string | null;
  channel: string;
  audience_source: string;
  criteria: Record<string, any>;
  recipients_total: number;
  sent_count: number;
  failed_count: number;
  errors: string[];
  started_at: string;
  finished_at: string | null;
  created_at: string;
  /** queued | processing | completed — estado do envio em segundo plano. */
  status?: string | null;
  /** Modelo do email guardado (envios pela fila) — para reutilizar a campanha. */
  body_html?: string | null;
  attachments?: Array<{ filename?: string; name?: string; content?: string; base64?: string; encoding?: string }> | null;
}

type UntypedClient = { from: (relation: string) => any };
const untyped = supabase as unknown as UntypedClient;

/**
 * Abre o registo de uma campanha antes de começar a enviar.
 *
 * É criado à partida (e não no fim) para que uma campanha interrompida a meio
 * — o utilizador fecha o separador, a ligação cai — deixe rasto na mesma, com
 * o número de enviados até esse ponto.
 */
export async function startCampaign(params: {
  subject: string;
  channel?: string;
  audienceSource: string;
  criteria?: Record<string, any>;
  recipientsTotal: number;
}): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await untyped
    .from("bulk_email_campaigns")
    .insert({
      user_id: user.id,
      subject: params.subject || null,
      channel: params.channel || "email",
      audience_source: params.audienceSource,
      criteria: params.criteria || {},
      recipients_total: params.recipientsTotal,
    })
    .select("id")
    .single();

  if (error) {
    // O registo é para relatório — nunca deve impedir o envio.
    console.error("[bulkCampaigns] Erro ao abrir a campanha:", error);
    return null;
  }

  return data?.id ?? null;
}

/** Fecha o registo com o resultado real do envio. */
export async function finishCampaign(
  campaignId: string | null,
  result: { sent: number; failed: number; errors: string[] }
): Promise<void> {
  if (!campaignId) return;

  const { error } = await untyped
    .from("bulk_email_campaigns")
    .update({
      sent_count: result.sent,
      failed_count: result.failed,
      // Só uma amostra: o detalhe todo iria inchar a linha sem acrescentar.
      errors: result.errors.slice(0, 20),
      finished_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) console.error("[bulkCampaigns] Erro ao fechar a campanha:", error);
}

export async function getCampaigns(limit = 50, audienceSource?: string): Promise<BulkEmailCampaign[]> {
  let query = untyped
    .from("bulk_email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (audienceSource) {
    query = query.eq("audience_source", audienceSource);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[bulkCampaigns] Erro ao carregar campanhas:", error);
    return [];
  }

  return (data ?? []) as BulkEmailCampaign[];
}
