import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { processInboxForUser, type InboxAccount } from "@/lib/server/inboxTriage";

export const config = { maxDuration: 60 };

/**
 * Assistente de emails de leads.
 *
 * Lê (só leitura, IMAP) a caixa de cada consultor com o assistente ligado,
 * a IA classifica CADA email (importância, se precisa de acompanhamento, do que
 * é e uma ação sugerida) e GUARDA apenas os que merecem atenção — não a caixa
 * inteira. Liga ao lead quando o remetente é conhecido. É a rede que garante que
 * uma resposta de cliente não passa despercebida.
 *
 * Corre a cada ~15 min (ver vercel.json). Protegido pelo CRON_SECRET.
 * A lógica por consultor está em `@/lib/server/inboxTriage` (partilhada com o
 * botão "Verificar agora").
 */

const MAX_USERS_PER_RUN = 25;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const deadline = Date.now() + 50_000;

  try {
    const { data: accounts } = await admin
      .from("user_smtp_settings")
      .select("user_id, smtp_host, smtp_username, smtp_password, from_email, reject_unauthorized, imap_host, imap_port, imap_last_uid, email_assistant_enabled, email_ignore_senders, inbox_reply_style")
      .eq("email_assistant_enabled", true)
      .limit(MAX_USERS_PER_RUN);

    let flagged = 0;
    let scanned = 0;

    for (const acc of (accounts as unknown as InboxAccount[]) || []) {
      if (Date.now() > deadline) break;
      const result = await processInboxForUser(admin, acc);
      scanned += result.scanned;
      flagged += result.flagged;
    }

    return res.status(200).json({ success: true, scanned, flagged });
  } catch (error: any) {
    console.error("[inbox-assistant] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro no assistente de emails" });
  }
}
