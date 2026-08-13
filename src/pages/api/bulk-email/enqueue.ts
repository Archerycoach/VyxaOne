import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { deriveAppUrl } from "@/lib/server/appUrl";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb", // acomoda uma brochura em anexo
    },
  },
};

/**
 * Enfileira um envio de emails em massa para ser processado EM SEGUNDO PLANO.
 *
 * Cria a campanha (com o modelo do email) e insere os destinatários na fila,
 * devolvendo de imediato — o utilizador fica livre para continuar a trabalhar.
 * O envio é feito depois pelo worker (auto-arranca aqui via /api/bulk-email/
 * process, e o cron de recuperação apanha o que ficar por enviar).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey);

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const {
      subject,
      html,
      attachments,
      sendCopyToSender,
      audienceSource,
      criteria,
      recipients,
      recipientsTotal,
    } = req.body as {
      subject?: string;
      html?: string;
      attachments?: Array<{ filename?: string; name?: string; content?: string; base64?: string; encoding?: string; url?: string; path?: string }>;
      sendCopyToSender?: boolean;
      audienceSource?: string;
      criteria?: Record<string, any>;
      /** Opcional: destinatários inline (envios pequenos). Nos grandes vêm depois, em blocos. */
      recipients?: Array<{
        email?: string;
        name?: string;
        vars?: Record<string, string>;
        leadId?: string | null;
        contactId?: string | null;
      }>;
      /** Total previsto de destinatários (quando vêm em blocos separados). */
      recipientsTotal?: number;
    };

    if (!subject?.trim() || !html?.trim()) {
      return res.status(400).json({ error: "Falta o assunto ou a mensagem." });
    }

    // Destinatários inline (envios pequenos): opcionais. Nos grandes, a lista
    // vem depois em blocos por /api/bulk-email/enqueue-recipients — evita que um
    // único pedido gigante estoure o limite de tamanho da plataforma.
    const seen = new Set<string>();
    const clean = (recipients || []).filter((r) => {
      const email = (r.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    const plannedTotal = typeof recipientsTotal === "number" && recipientsTotal > 0 ? recipientsTotal : clean.length;
    if (plannedTotal === 0) {
      return res.status(400).json({ error: "Nenhum destinatário com email." });
    }

    // Anexos no formato do nodemailer. Preferência: por LINK ({filename, path}
    // — o nodemailer descarrega no envio), que é como o cliente envia agora
    // (ficheiro na Storage, só a referência no pedido). Base64 mantém-se
    // aceite para templates/campanhas antigos guardados nesse formato.
    const normalizedAttachments = (attachments || [])
      .map((a) => {
        const filename = a.filename || a.name || "Anexo";
        const path = a.url || a.path;
        if (path) return { filename, path };
        return {
          filename,
          content: a.content || a.base64 || "",
          encoding: a.encoding || "base64",
        };
      })
      .filter((a) => ("path" in a && a.path) || ("content" in a && a.content));

    // 1. Campanha com o modelo do email e o estado inicial.
    const { data: campaign, error: campaignError } = await admin
      .from("bulk_email_campaigns")
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        channel: "email",
        audience_source: audienceSource || "manual",
        criteria: criteria || {},
        recipients_total: plannedTotal,
        body_html: html,
        attachments: normalizedAttachments,
        copy_to_email: sendCopyToSender ? user.email || null : null,
        status: "queued",
      })
      .select("id")
      .single();

    if (campaignError || !campaign) {
      console.error("[enqueue] Erro ao criar campanha:", campaignError);
      return res.status(500).json({ error: "Não foi possível criar a campanha." });
    }

    // 2. Destinatários inline (envios pequenos): insere já e arranca. Nos
    //    envios grandes NÃO vêm aqui — o cliente adiciona-os em blocos por
    //    /api/bulk-email/enqueue-recipients (e é lá que arranca o worker).
    if (clean.length > 0) {
      const queueRows = clean.map((r) => ({
        campaign_id: campaign.id,
        user_id: user.id,
        to_email: (r.email as string).trim(),
        recipient_name: r.name || null,
        vars: r.vars || {},
        lead_id: r.leadId || null,
        contact_id: r.contactId || null,
      }));

      for (let i = 0; i < queueRows.length; i += 500) {
        const { error: qError } = await admin.from("bulk_email_queue").insert(queueRows.slice(i, i + 500));
        if (qError) {
          console.error("[enqueue] Erro ao inserir na fila:", qError);
          return res.status(500).json({ error: "Falha ao preparar a fila de envio." });
        }
      }

      const appUrl = deriveAppUrl(req);
      void fetch(`${appUrl}/api/bulk-email/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body: JSON.stringify({ campaignId: campaign.id }),
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, campaignId: campaign.id, queued: clean.length });
  } catch (error: any) {
    console.error("[enqueue]", error);
    return res.status(500).json({ error: error.message || "Erro ao enfileirar o envio." });
  }
}
