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

/** Descodifica quoted-printable para UTF-8 (junta bytes; não assume ASCII). */
function decodeQuotedPrintable(input: string): string {
  const noSoftBreaks = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < noSoftBreaks.length; i++) {
    const ch = noSoftBreaks[i];
    if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(noSoftBreaks.substr(i + 1, 2))) {
      bytes.push(parseInt(noSoftBreaks.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(noSoftBreaks.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** Parece uma sequência base64 (blocos longos do charset base64)? */
function looksBase64(input: string): boolean {
  const compact = input.replace(/\s+/g, "");
  return compact.length > 24 && /^[A-Za-z0-9+/=]+$/.test(compact);
}

/**
 * Extrai texto LEGÍVEL do corpo IMAP para a triagem. O `bodyParts:["TEXT"]` vem
 * cru: pode ser multipart (com fronteiras e sub-cabeçalhos) e/ou codificado em
 * base64 / quoted-printable. Sem descodificar, a IA lê lixo e classifica mal.
 * Heurística: se for multipart, escolhe o text/plain (senão text/html) e
 * descodifica pela Content-Transfer-Encoding; se for parte única, tenta
 * detetar a codificação. É best-effort — não precisa de ser perfeito.
 */
function extractReadableText(raw: string): string {
  if (!raw) return "";

  // Multipart? Divide pelas linhas de fronteira ("--boundary").
  const looksMultipart = /Content-Type:\s*multipart/i.test(raw) || /^--[^\r\n]+$/m.test(raw);
  if (looksMultipart && /Content-Type:/i.test(raw)) {
    const segments = raw.split(/^--[^\r\n]*\r?\n/m).filter((s) => /Content-Type:/i.test(s));
    const pick = (type: RegExp) => segments.find((s) => type.test(s));
    const seg = pick(/Content-Type:\s*text\/plain/i) || pick(/Content-Type:\s*text\/html/i);
    if (seg) {
      const splitAt = seg.search(/\r?\n\r?\n/);
      const header = splitAt >= 0 ? seg.slice(0, splitAt) : "";
      let body = splitAt >= 0 ? seg.slice(splitAt).trim() : seg;
      if (/Content-Transfer-Encoding:\s*base64/i.test(header)) {
        body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
      } else if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(header)) {
        body = decodeQuotedPrintable(body);
      }
      return htmlToText(body);
    }
  }

  // Parte única: deteta a codificação pelo conteúdo.
  let body = raw;
  if (/=[0-9A-Fa-f]{2}/.test(body) && /=\r?\n|=[0-9A-Fa-f]{2}/.test(body)) {
    body = decodeQuotedPrintable(body);
  } else if (looksBase64(body)) {
    try { body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { /* mantém */ }
  }
  return htmlToText(body);
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
}): Promise<{ messages: InboxMessage[]; highestUid: number; totalInWindow: number }> {
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
    const totalInWindow = uids.length;
    const fresh = uids
      .filter((u) => u > opts.lastUid)
      .sort((a, b) => a - b)
      .slice(0, opts.maxMessages ?? 40);

    if (fresh.length === 0) return { messages, highestUid, totalInWindow };

    // `fresh` são UIDs (vieram do search com {uid:true}); é OBRIGATÓRIO passar
    // {uid:true} também aqui, senão o imapflow trata-os como nºs de sequência
    // (UIDs >> nº de mensagens → o servidor rejeita: "Command failed").
    for await (const msg of client.fetch(
      fresh,
      { uid: true, envelope: true, internalDate: true, bodyParts: ["TEXT"] },
      { uid: true },
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
        text: extractReadableText(rawBody).slice(0, 1800),
      });
    }
    return { messages, highestUid, totalInWindow };
  } finally {
    lock.release();
    await client.logout();
  }
}
