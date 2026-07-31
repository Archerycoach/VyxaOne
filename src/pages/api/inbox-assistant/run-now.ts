import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processInboxForUser, type InboxAccount } from "@/lib/server/inboxTriage";

export const config = { maxDuration: 60 };

/**
 * "Verificar agora" — corre o assistente de emails para o PRÓPRIO consultor,
 * na hora, sem esperar pelo cron. Útil para confirmar que o IMAP liga e ver o
 * resultado (quantos emails leu, quantos sinalizou, ou o erro de ligação).
 *
 * Autentica pelo token do utilizador; usa a service-role só para gravar em
 * `inbox_triage` (o INSERT está reservado à service-role por RLS).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

  try {
    const { data: acc } = await supabaseAdmin
      .from("user_smtp_settings")
      .select("user_id, smtp_host, smtp_username, smtp_password, reject_unauthorized, imap_host, imap_port, imap_last_uid, email_assistant_enabled, email_ignore_senders, inbox_reply_style")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!acc) {
      return res.status(400).json({ error: "Ainda não configurou o email (Configurações SMTP)." });
    }
    if (!(acc as any).email_assistant_enabled) {
      return res.status(400).json({ error: "O assistente de emails está desligado. Ative-o nas Configurações SMTP." });
    }

    // Manual = varre sempre a janela toda (ignoreCursor), para não depender do
    // marcador incremental do cron e servir de diagnóstico/catch-up fiável.
    const result = await processInboxForUser(supabaseAdmin, acc as unknown as InboxAccount, {
      ignoreCursor: true,
    });

    if (result.imapError) {
      return res.status(200).json({
        success: false,
        scanned: 0,
        flagged: 0,
        message: `Não foi possível ligar à caixa de correio: ${result.imapError}`,
      });
    }

    let message: string;
    if (result.windowTotal === 0) {
      message = "Ligação OK. Não há emails na caixa de entrada nos últimos 3 dias.";
    } else if (result.flagged > 0) {
      if (result.writeError) {
        message = `Analisei ${result.scanned}; ${result.flagged} a precisar de atenção, mas a gravação falhou: ${result.writeError}`;
      } else {
        message = `Analisei ${result.scanned} email(s) dos últimos 3 dias; ${result.flagged} a precisar de atenção` +
          (typeof result.storedNew === "number" ? ` (${result.storedNew} guardado(s)).` : ".");
      }
    } else if (result.aiCovered < result.afterFilter) {
      // A IA não classificou tudo — resposta incompleta/inválida.
      message = `Li ${result.scanned} email(s), mas a IA só conseguiu classificar ${result.aiCovered} de ${result.afterFilter}.`;
      if (result.aiCovered === 0 && result.debugSample) {
        message += ` Resposta da IA (início): "${result.debugSample}"`;
      } else {
        message += ' Tente "Verificar agora" outra vez.';
      }
    } else {
      const filtered = result.scanned - result.afterFilter;
      message =
        `Analisei ${result.scanned} email(s); nenhum considerado a precisar de atenção` +
        (filtered > 0 ? ` (${filtered} ignorado(s) como publicidade/automáticos).` : ".");
    }

    return res.status(200).json({
      success: true,
      scanned: result.scanned,
      flagged: result.flagged,
      afterFilter: result.afterFilter,
      aiCovered: result.aiCovered,
      windowTotal: result.windowTotal,
      storedNew: result.storedNew,
      message,
    });
  } catch (error: any) {
    console.error("[inbox-assistant/run-now] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao verificar a caixa." });
  }
}
