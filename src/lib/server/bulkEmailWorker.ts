import nodemailer from "nodemailer";
import { getSignatureHtml } from "@/lib/server/emailSignature";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { personalizeMailMerge } from "@/lib/mailMergeVars";
import { getEspConfig, sendViaEsp } from "@/lib/server/bulkEmailEsp";

/**
 * Worker do envio de emails em massa em segundo plano.
 *
 * Processa a fila `bulk_email_queue` em lotes: para cada destinatário compõe o
 * email a partir do modelo da campanha (assunto + corpo, com as variáveis
 * substituídas linha a linha), envia pelo SMTP do consultor e atualiza o
 * estado. As contagens da campanha (sent/failed) são recalculadas a partir da
 * fila — fonte de verdade — para o "Histórico de envios" mostrar o progresso.
 *
 * Corre sempre com a service_role (ignora RLS): é chamado pelo endpoint de
 * processamento (auto-encadeado) e pelo cron de recuperação.
 */

const DEFAULT_BATCH = 100;
const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MINUTES = 10;
// Pausa após bater no limite do SMTP (ex.: limite horário de envio). Espaça as
// tentativas por ~1h, o tempo típico de um limite "por hora" repor.
const RATE_LIMIT_COOLDOWN_MINUTES = 60;
// Ritmo de envio. O ganho grande vem de NÃO reabrir a ligação a cada email: com
// `pool` o nodemailer reutiliza a mesma ligação SMTP (poupa o handshake TLS +
// AUTH, que era o custo dominante). O `rateLimit` mantém um teto de mensagens
// por segundo (no total do pool) para não disparar rajadas — e os limites do
// próprio servidor continuam a ser apanhados pelo tratamento de erros
// temporários (cooldown de 1h). Substitui a antiga pausa fixa de 400 ms.
const POOL_MAX_CONNECTIONS = 4;
const POOL_RATE_LIMIT = 8; // mensagens por segundo, no total do pool (por consultor)
// Nº de emails enviados EM PARALELO por ciclo. Sozinho, o loop era sequencial:
// esperava cada envio (ida à rede + escritas na BD) antes do seguinte e nunca
// chegava perto do teto do pool. Com concorrência, satura o `rateLimit`. Como o
// pool (por consultor) continua a limitar o ritmo real, não rebenta o servidor.
const SEND_CONCURRENCY = 4;

/**
 * O erro do SMTP é TEMPORÁRIO (limite de envio, rate-limit, greylisting)?
 * Nesse caso o email não falhou — deve ser reenviado mais tarde, não descartado.
 * Cobre a família 4xx e as mensagens típicas (450 4.7.1, "exceeded", "IHL",
 * "try again later", "too many", "rate limit", "greylist", "temporarily").
 */
function isTransientSmtpError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    /\b4\d\d[ -]4\.\d\.\d\b/.test(m) ||
    /\b(421|450|451|452)\b/.test(m) ||
    m.includes("try again later") ||
    m.includes("exceeded") ||
    m.includes("message limit") ||
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("greylist") ||
    m.includes("temporar") ||
    m.includes("(ihl)") ||
    m.includes("quota")
  );
}

interface SmtpSettingsRow {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  reject_unauthorized: boolean | null;
  from_name: string | null;
  from_email: string;
}

async function countQueue(admin: any, campaignId: string, status: string | string[]): Promise<number> {
  let q = admin.from("bulk_email_queue").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId);
  q = Array.isArray(status) ? q.in("status", status) : q.eq("status", status);
  const { count } = await q;
  return count || 0;
}

/** Reconcilia as contagens da campanha a partir da fila e fecha-a se terminou. */
async function reconcileCampaign(admin: any, campaignId: string): Promise<number> {
  const [sent, failed, pending] = await Promise.all([
    countQueue(admin, campaignId, "sent"),
    countQueue(admin, campaignId, "failed"),
    countQueue(admin, campaignId, ["pending", "processing"]),
  ]);

  const { data: errRows } = await admin
    .from("bulk_email_queue")
    .select("recipient_name, to_email, error")
    .eq("campaign_id", campaignId)
    .eq("status", "failed")
    .limit(20);

  const errors = (errRows || []).map(
    (e: any) => `${e.recipient_name || e.to_email}: ${e.error || "erro"}`,
  );

  const update: Record<string, any> = { sent_count: sent, failed_count: failed, errors };
  if (pending === 0) {
    update.status = "completed";
    update.finished_at = new Date().toISOString();
  } else {
    // Ainda há emails por enviar (inclui os recuperados por rate-limit): volta
    // a "em curso" E limpa a marca de concluída — senão o relatório não a
    // reconhecia como ativa e o refresh automático não ligava.
    update.status = "processing";
    update.finished_at = null;
  }

  await admin.from("bulk_email_campaigns").update(update).eq("id", campaignId);
  return pending;
}

export async function processBulkEmailBatch(
  admin: any,
  opts: { campaignId?: string; batchSize?: number } = {},
): Promise<{ processed: number; remaining: number }> {
  const batchSize = opts.batchSize || DEFAULT_BATCH;

  // Recuperar linhas presas em "processing" há demasiado tempo (um envio que
  // morreu a meio): voltam a "pending", ou vão a "failed" se já esgotaram as
  // tentativas. Usa claimed_at (hora em que foi reivindicada) e NÃO created_at
  // — assim nunca se repõe uma linha que está a ser enviada neste momento,
  // evitando envios duplicados em campanhas longas.
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60000).toISOString();
  await admin
    .from("bulk_email_queue")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "processing")
    .lt("attempts", MAX_ATTEMPTS)
    .lt("claimed_at", staleCutoff);
  await admin
    .from("bulk_email_queue")
    .update({ status: "failed", error: "Excedeu as tentativas de envio." })
    .eq("status", "processing")
    .gte("attempts", MAX_ATTEMPTS)
    .lt("claimed_at", staleCutoff);

  const nowIso = new Date().toISOString();
  const cooldownIso = new Date(Date.now() + RATE_LIMIT_COOLDOWN_MINUTES * 60000).toISOString();

  // Recuperar emails marcados como falhados por um erro TEMPORÁRIO (limite de
  // envio do SMTP): voltam à fila ELEGÍVEIS já (next_attempt_at = null), para a
  // campanha voltar de imediato a "em curso" no relatório. Se o limite ainda
  // estiver ativo, a primeira tentativa apanha o 450 e aí sim a fila arrefece
  // ~1h; se já tiver reposto, começam a sair logo. Não toca nas falhas
  // definitivas (endereço inválido, etc.).
  await admin
    .from("bulk_email_queue")
    .update({ status: "pending", claimed_at: null, next_attempt_at: null })
    .eq("status", "failed")
    .lt("attempts", MAX_ATTEMPTS)
    .or(
      "error.ilike.%exceeded%,error.ilike.%message limit%,error.ilike.%try again later%,error.ilike.%rate limit%,error.ilike.%too many%,error.ilike.%greylist%,error.ilike.%temporar%,error.ilike.%quota%",
    );

  // Lote de pendentes que já podem ser tentados (next_attempt_at no passado ou
  // por preencher). Rejeitados com pausa por rate-limit ficam de fora até à hora.
  let query = admin
    .from("bulk_email_queue")
    .select("*")
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (opts.campaignId) query = query.eq("campaign_id", opts.campaignId);

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    if (opts.campaignId) await reconcileCampaign(admin, opts.campaignId);
    return { processed: 0, remaining: 0 };
  }

  const campaignCache = new Map<string, any>();
  const smtpCache = new Map<string, SmtpSettingsRow | null>();
  const transporterCache = new Map<string, nodemailer.Transporter>();
  // Todos os transporters criados neste ciclo — incluindo algum duplicado que a
  // concorrência possa criar em cache fria — para os fechar todos no fim e não
  // deixar ligações SMTP penduradas.
  const allTransporters: nodemailer.Transporter[] = [];
  const signatureCache = new Map<string, string>();
  const touchedCampaigns = new Set<string>();
  // Consultores que bateram no limite do SMTP NESTA execução: paramos de lhes
  // enviar já e reagendamos o resto — evita gerar centenas de 450 seguidos.
  const rateLimitedUsers = new Set<string>();
  let processed = 0;

  // ESP (Resend, etc.) para envio em massa por API HTTP, quando configurado. As
  // campanhas passam por aqui (alto débito, entregável), em vez do SMTP da caixa
  // do consultor (que tem limites apertados). Lê-se uma vez por ciclo.
  const espConfig = await getEspConfig(admin);

  const rowList = rows as any[];

  const processRow = async (row: any) => {
    touchedCampaigns.add(row.campaign_id);

    // Já bateu no limite este ciclo: reagenda sem sequer tentar enviar.
    if (rateLimitedUsers.has(row.user_id)) {
      await admin
        .from("bulk_email_queue")
        .update({ status: "pending", claimed_at: null, next_attempt_at: cooldownIso })
        .eq("id", row.id);
      return;
    }

    // Reivindicar a linha (evita duplo envio se dois workers coincidirem).
    const { data: claimed } = await admin
      .from("bulk_email_queue")
      .update({ status: "processing", claimed_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    try {
      // Campanha (modelo do email).
      let campaign = campaignCache.get(row.campaign_id);
      if (!campaign) {
        const { data } = await admin
          .from("bulk_email_campaigns")
          .select("id, subject, body_html, attachments, copy_to_email, copy_sent, user_id")
          .eq("id", row.campaign_id)
          .maybeSingle();
        campaign = data;
        campaignCache.set(row.campaign_id, data);
      }
      if (!campaign) throw new Error("Campanha não encontrada.");

      // SMTP do consultor.
      let smtp = smtpCache.get(row.user_id);
      if (smtp === undefined) {
        const { data } = await admin
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", row.user_id)
          .maybeSingle();
        smtp = (data as SmtpSettingsRow) || null;
        smtpCache.set(row.user_id, smtp);
      }
      // Com ESP, o SMTP do consultor é OPCIONAL (só dá o nome e o reply-to).
      // Sem ESP, é obrigatório para poder enviar.
      if (!espConfig && !smtp?.smtp_host) throw new Error("SMTP não configurado.");

      let transporter = transporterCache.get(row.user_id);
      if (!espConfig && !transporter && smtp?.smtp_host) {
        transporter = nodemailer.createTransport({
          host: smtp.smtp_host,
          port: smtp.smtp_port,
          secure: smtp.smtp_secure,
          auth: { user: smtp.smtp_username, pass: smtp.smtp_password },
          tls: { rejectUnauthorized: smtp.reject_unauthorized ?? true },
          // Pool: reutiliza a ligação SMTP entre emails (o grande acelerador) e
          // limita o ritmo a POOL_RATE_LIMIT msg/seg para não fazer rajadas.
          pool: true,
          maxConnections: POOL_MAX_CONNECTIONS,
          maxMessages: Infinity,
          rateDelta: 1000,
          rateLimit: POOL_RATE_LIMIT,
        });
        transporterCache.set(row.user_id, transporter);
        allTransporters.push(transporter);
      }

      // Assinatura do consultor em cache (uma leitura por consultor, não por email).
      let signature = signatureCache.get(row.user_id);
      if (signature === undefined) {
        signature = await getSignatureHtml(admin, row.user_id);
        signatureCache.set(row.user_id, signature);
      }

      const vars = (row.vars || {}) as Record<string, string>;
      const subject = personalizeMailMerge(String(campaign.subject || ""), vars);
      const bodyHtml = personalizeMailMerge(String(campaign.body_html || ""), vars);
      const finalHtml = signature ? `${bodyHtml}${signature}` : bodyHtml;

      const attachments = Array.isArray(campaign.attachments) ? campaign.attachments : [];

      // Cópia para o próprio: uma única vez por campanha (reivindicada com um
      // update condicional a copy_sent=false).
      let bcc: string[] | undefined;
      if (campaign.copy_to_email && !campaign.copy_sent) {
        const { data: copyClaim } = await admin
          .from("bulk_email_campaigns")
          .update({ copy_sent: true })
          .eq("id", campaign.id)
          .eq("copy_sent", false)
          .select("id")
          .maybeSingle();
        if (copyClaim) {
          bcc = [campaign.copy_to_email];
          campaign.copy_sent = true;
        }
      }

      if (espConfig) {
        // Campanha pelo ESP: alto débito por API HTTP. Mostra o nome do
        // consultor e as respostas vão para o email dele (reply-to).
        await sendViaEsp(espConfig, {
          fromName: smtp?.from_name || null,
          replyTo: smtp?.from_email || null,
          to: row.to_email,
          subject,
          html: finalHtml,
          bcc,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } else {
        await transporter!.sendMail({
          from: smtp!.from_name ? `"${smtp!.from_name}" <${smtp!.from_email}>` : smtp!.from_email,
          to: row.to_email,
          subject,
          html: finalHtml,
          attachments: attachments.length > 0 ? attachments : undefined,
          bcc,
        });
      }

      await admin
        .from("bulk_email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);

      // Regista a interação na lead/contacto, como o envio manual já fazia.
      if (row.lead_id || row.contact_id) {
        try {
          await logEmailInteractionServer(admin, {
            leadId: row.lead_id || undefined,
            contactId: row.contact_id || undefined,
            userId: row.user_id,
            to: row.to_email,
            subject,
            body: bodyHtml,
            outcome: "Email enviado (campanha)",
          });
        } catch (logErr) {
          console.error("[bulkEmailWorker] Falha a registar interação (não bloqueante):", logErr);
        }
      }
    } catch (sendError: any) {
      const message = sendError?.message || "Falha ao enviar";

      if (isTransientSmtpError(message)) {
        // Erro TEMPORÁRIO (limite/rate-limit): NÃO falha — volta à fila com
        // pausa, e paramos de enviar a este consultor neste ciclo. attempts
        // volta ao valor original (a tentativa reivindicada não conta como
        // gasta, senão o limite horário esgotava as 3 tentativas à toa).
        const firstHit = !rateLimitedUsers.has(row.user_id);
        rateLimitedUsers.add(row.user_id);
        await admin
          .from("bulk_email_queue")
          .update({
            status: "pending",
            claimed_at: null,
            attempts: row.attempts || 0,
            next_attempt_at: cooldownIso,
            error: message.slice(0, 300),
          })
          .eq("id", row.id);

        // Na primeira vez, arrefece TODA a fila pendente deste consultor — os
        // ciclos seguintes (cron a cada 5 min) não voltam a martelar o SMTP
        // dentro da hora; retomam quando a pausa passar.
        if (firstHit) {
          await admin
            .from("bulk_email_queue")
            .update({ next_attempt_at: cooldownIso })
            .eq("user_id", row.user_id)
            .eq("status", "pending")
            .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`);
        }
      } else {
        await admin
          .from("bulk_email_queue")
          .update({ status: "failed", error: message.slice(0, 300) })
          .eq("id", row.id);
      }
    }

    processed++;
    // Sem pausa fixa: o ritmo é governado pelo `rateLimit` do pool SMTP, que
    // reutiliza a ligação e mantém um teto seguro de mensagens por segundo.
  };

  // Envio com CONCORRÊNCIA limitada: vários trabalhadores puxam linhas da mesma
  // lista (cada linha só é processada uma vez). O `rateLimit` do pool SMTP e o
  // tratamento de erros temporários continuam a proteger o servidor de destino.
  let cursor = 0;
  const runWorker = async () => {
    while (cursor < rowList.length) {
      const row = rowList[cursor++];
      await processRow(row);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(SEND_CONCURRENCY, rowList.length) }, runWorker),
  );

  // Fecha as ligações do pool SMTP abertas neste ciclo (liberta os sockets).
  for (const t of allTransporters) {
    try {
      t.close();
    } catch {
      // fecho best-effort — não bloqueia a reconciliação.
    }
  }

  // Atualizar contagens de todas as campanhas tocadas neste lote.
  let remaining = 0;
  for (const cid of touchedCampaigns) {
    const pending = await reconcileCampaign(admin, cid);
    if (opts.campaignId ? cid === opts.campaignId : true) remaining += pending;
  }

  return { processed, remaining };
}
