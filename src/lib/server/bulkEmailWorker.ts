import nodemailer from "nodemailer";
import { getSignatureHtml } from "@/lib/server/emailSignature";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { personalizeMailMerge } from "@/lib/mailMergeVars";

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

const DEFAULT_BATCH = 25;
const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MINUTES = 10;

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
    update.status = "processing";
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

  // Lote de pendentes.
  let query = admin
    .from("bulk_email_queue")
    .select("*")
    .eq("status", "pending")
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
  const signatureCache = new Map<string, string>();
  const touchedCampaigns = new Set<string>();
  let processed = 0;

  for (const row of rows as any[]) {
    touchedCampaigns.add(row.campaign_id);

    // Reivindicar a linha (evita duplo envio se dois workers coincidirem).
    const { data: claimed } = await admin
      .from("bulk_email_queue")
      .update({ status: "processing", claimed_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

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
      if (!smtp?.smtp_host) throw new Error("SMTP não configurado.");

      let transporter = transporterCache.get(row.user_id);
      if (!transporter) {
        transporter = nodemailer.createTransport({
          host: smtp.smtp_host,
          port: smtp.smtp_port,
          secure: smtp.smtp_secure,
          auth: { user: smtp.smtp_username, pass: smtp.smtp_password },
          tls: { rejectUnauthorized: smtp.reject_unauthorized ?? true },
        });
        transporterCache.set(row.user_id, transporter);
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

      await transporter.sendMail({
        from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
        to: row.to_email,
        subject,
        html: finalHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
        bcc,
      });

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
      await admin
        .from("bulk_email_queue")
        .update({ status: "failed", error: sendError?.message || "Falha ao enviar" })
        .eq("id", row.id);
    }

    processed++;
  }

  // Atualizar contagens de todas as campanhas tocadas neste lote.
  let remaining = 0;
  for (const cid of touchedCampaigns) {
    const pending = await reconcileCampaign(admin, cid);
    if (opts.campaignId ? cid === opts.campaignId : true) remaining += pending;
  }

  return { processed, remaining };
}
