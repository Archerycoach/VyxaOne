import { ImapFlow } from "imapflow";

/**
 * Leitura (só leitura) da caixa de entrada do consultor por IMAP, para o
 * assistente de emails. Vai buscar as mensagens recentes ainda não vistas
 * (UID acima do último processado) e devolve o essencial para a IA triar —
 * remetente, assunto e um EXCERTO do corpo (não o corpo inteiro).
 *
 * Nada é escrito na caixa: nem flags, nem apagar, nem mover. É uma leitura
 * passiva. O que merecer atenção é guardado à parte (tabela inbox_triage).
 */

export interface InboxMessage {
  uid: number;
  fromEmail: string | null;
  fromName: string | null;
  subject: string | null;
  receivedAt: string | null;
  text: string;
}

/** Reduz HTML a texto legível para a triagem — não precisa de ser perfeito. */
function htmlToText(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function readNewInboxMessages(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  rejectUnauthorized?: boolean;
  lastUid: number;
  sinceDays?: number;
  maxMessages?: number;
}): Promise<{ messages: InboxMessage[]; highestUid: number }> {
  const client = new ImapFlow({
    host: opts.host,
    port: opts.port || 993,
    secure: true,
    auth: { user: opts.user, pass: opts.pass },
    tls: { rejectUnauthorized: opts.rejectUnauthorized ?? true },
    logger: false,
  });

  const messages: InboxMessage[] = [];
  let highestUid = opts.lastUid;

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    // Limita por data (por defeito 3 dias) para NUNCA varrer o histórico todo,
    // sobretudo no primeiro ciclo (lastUid = 0).
    const since = new Date(Date.now() - (opts.sinceDays ?? 3) * 86400000);
    const uids = (await client.search({ since }, { uid: true })) || [];
    const fresh = uids
      .filter((u) => u > opts.lastUid)
      .sort((a, b) => a - b)
      .slice(0, opts.maxMessages ?? 40);

    if (fresh.length === 0) return { messages, highestUid };

    for await (const msg of client.fetch(
      fresh,
      { uid: true, envelope: true, internalDate: true, bodyParts: ["TEXT"] },
    )) {
      const uid = msg.uid as number;
      if (uid > highestUid) highestUid = uid;

      const from = msg.envelope?.from?.[0];
      const rawPart = (msg.bodyParts as Map<string, Buffer> | undefined)?.get("TEXT");
      const rawBody = rawPart ? rawPart.toString("utf8") : "";

      messages.push({
        uid,
        fromEmail: from?.address || null,
        fromName: from?.name || null,
        subject: msg.envelope?.subject || null,
        receivedAt: msg.internalDate ? new Date(msg.internalDate).toISOString() : null,
        text: htmlToText(rawBody).slice(0, 1800),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return { messages, highestUid };
}
