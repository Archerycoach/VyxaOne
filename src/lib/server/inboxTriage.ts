import type { SupabaseClient } from "@supabase/supabase-js";
import { readNewInboxMessages, type InboxMessage } from "@/lib/server/inboxReader";
import { runAI } from "@/lib/ai/provider";

/**
 * Lógica partilhada do assistente de emails: ler a caixa (IMAP, só leitura) de
 * UM consultor, pedir à IA lembretes/conselhos e guardar só os que merecem
 * atenção. Usada pelo cron (`/api/cron/inbox-assistant`, todos os consultores)
 * e pelo "Verificar agora" (`/api/inbox-assistant/run-now`, o próprio).
 */

export const MAX_MESSAGES_PER_USER = 40;

// Remetentes automáticos/publicidade — apanhados por heurística ANTES da IA
// (poupa custo e reduz a exposição de conteúdo a analisar).
const ADVERTISING_SENDER_HINTS = [
  "noreply", "no-reply", "no.reply", "donotreply", "do-not-reply", "naoresponder",
  "newsletter", "mailer", "mailing", "marketing", "notification", "notifica",
  "promo", "publicidade", "campaign", "info@", "news@", "hello@", "updates@",
];

/**
 * Deve este email ser IGNORADO antes de chegar à IA? Sim se o remetente estiver
 * na lista do consultor (endereço exato ou domínio "@dominio"), ou se parecer
 * publicidade/automático pela heurística do remetente.
 */
export function shouldIgnore(fromEmail: string | null, ignoreList: string[]): boolean {
  const email = (fromEmail || "").toLowerCase().trim();
  if (!email) return false;

  for (const raw of ignoreList || []) {
    const rule = String(raw || "").toLowerCase().trim();
    if (!rule) continue;
    if (rule.startsWith("@") ? email.endsWith(rule) : email === rule || email.includes(rule)) {
      return true;
    }
  }

  const localPart = email.split("@")[0] || "";
  return ADVERTISING_SENDER_HINTS.some((hint) =>
    hint.includes("@") ? email.startsWith(hint) : localPart.includes(hint)
  );
}

interface TriageResult {
  importance: "high" | "medium" | "low";
  reminder: string;
  advice: string;
  agendaSuggestion: string;
}

/**
 * Pede à IA para, a partir dos emails, gerar LEMBRETES e CONSELHOS (não uma
 * cópia dos emails). O conteúdo é lido, analisado e descartado — só o conselho
 * volta para ser guardado.
 */
interface TriageBatchOutcome {
  /** Alinhado a `messages` por índice; posições não classificadas ficam undefined. */
  results: (TriageResult | undefined)[];
  /** Resposta crua da IA (para diagnóstico quando o parse falha). */
  raw: string;
}

/**
 * Extrai os itens de triagem da resposta da IA, tolerante a formato: aceita um
 * array no topo OU um objeto `{items|results|...: [...]}`, e mapeia cada item à
 * sua posição pelo campo `i` (à prova de desalinhamento/ordem).
 */
function parseTriage(raw: string, expected: number): (TriageResult | undefined)[] {
  const results: (TriageResult | undefined)[] = new Array(expected).fill(undefined);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  let root: any = null;
  try {
    root = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try { root = JSON.parse(match[0]); } catch { /* desiste — devolve vazio */ }
    }
  }
  if (!root) return results;

  const arr: any[] | null = Array.isArray(root)
    ? root
    : root.items || root.results || root.emails || root.data ||
      (Object.values(root).find((v) => Array.isArray(v)) as any[]) || null;
  if (!Array.isArray(arr)) return results;

  arr.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const pos = typeof item.i === "number" ? item.i : idx;
    if (pos < 0 || pos >= expected) return;
    results[pos] = {
      importance: item.importance === "high" || item.importance === "medium" ? item.importance : "low",
      reminder: item.reminder || "",
      advice: item.advice || "",
      agendaSuggestion: item.agendaSuggestion || "",
    };
  });
  return results;
}

async function triageBatch(userId: string, messages: InboxMessage[]): Promise<TriageBatchOutcome> {
  const list = messages.map((m, i) => ({
    i,
    de: m.fromName || m.fromEmail || "remetente desconhecido",
    assunto: m.subject || "(sem assunto)",
    excerto: (m.text || "").slice(0, 800),
  }));

  const prompt = `És o assistente de um consultor imobiliário. Lês a caixa de entrada dele e transformas o que importa em LEMBRETES e CONSELHOS práticos. NÃO resumas a caixa toda — só o que exige atenção ou ação (resposta de cliente/lead, pergunta, objeção, pedido de visita/proposta, prazo, oportunidade). Ignora newsletters, promoções, notificações automáticas e spam.

Para CADA email, classifica:
- importance: "high" (precisa de ação hoje/amanhã), "medium" (a acompanhar), "low" (nada a fazer).
- reminder: UMA frase com o que precisa de atenção, dirigida ao consultor (ex.: "A Maria pergunta se pode visitar o T3 este fim de semana.").
- advice: conselho curto de COMO tratar e responder (tom, o que dizer, o que confirmar).
- agendaSuggestion: conselho de AGENDA/timing, ou "" se não aplicável.

EMAILS (JSON):
${JSON.stringify(list)}

Responde APENAS com um objeto JSON com a chave "items" — um item por email, incluindo o mesmo "i" do email de entrada:
{"items":[{"i":0,"importance":"high|medium|low","reminder":"...","advice":"...","agendaSuggestion":"..."}]}`;

  const response = await runAI({
    userId,
    task: "inbox_triage",
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 4000,
  });

  const raw = response.text || "";
  const results = parseTriage(raw, messages.length);
  if (results.every((r) => !r)) {
    console.error("[inbox-assistant] Triagem sem itens válidos:", {
      emails: messages.length,
      rawLength: raw.length,
      rawHead: raw.slice(0, 200),
    });
  }
  return { results, raw };
}

/**
 * Traduz um erro do ImapFlow numa mensagem acionável. O `.message` costuma ser
 * só "Command failed" — o detalhe real está em `responseText`/`serverResponseCode`
 * (resposta do servidor) ou no `code` de rede (host/porta errados, timeout).
 */
function describeImapError(err: any, host: string, port: number): string {
  const netCode = err?.code as string | undefined;
  const netMap: Record<string, string> = {
    ENOTFOUND: `Servidor não encontrado (${host}). Confirme o endereço IMAP.`,
    ECONNREFUSED: `Ligação recusada em ${host}:${port}. Confirme servidor e porta (normalmente 993).`,
    ETIMEDOUT: `Tempo esgotado a ligar a ${host}:${port}. Servidor/porta errados ou bloqueio de firewall.`,
    EAI_AGAIN: `Falha de DNS ao resolver ${host}. Confirme o endereço IMAP.`,
    CERT_HAS_EXPIRED: "Certificado do servidor expirado. Pode ter de desligar a validação de certificado.",
    DEPTH_ZERO_SELF_SIGNED_CERT: "Certificado auto-assinado. Pode ter de desligar a validação de certificado.",
  };
  if (netCode && netMap[netCode]) return netMap[netCode];

  if (err?.authenticationFailed) {
    return "Autenticação recusada. A palavra-passe pode estar errada — ou (Microsoft 365/Gmail) o IMAP com palavra-passe está bloqueado e exige OAuth.";
  }

  const serverText: string | undefined = err?.responseText || err?.response;
  const code: string | undefined = err?.serverResponseCode;
  if (serverText || code) {
    const detail = [serverText, code].filter(Boolean).join(" — ");
    if (/auth|login|credential|password|denied/i.test(detail)) {
      return `Autenticação recusada pelo servidor: ${detail}. Se for Microsoft 365/Gmail, o IMAP básico está bloqueado (exige OAuth).`;
    }
    return `O servidor recusou o comando: ${detail}.`;
  }

  return err?.message || "Falha na ligação IMAP.";
}

export interface InboxAccount {
  user_id: string;
  smtp_host: string | null;
  smtp_username: string | null;
  smtp_password: string | null;
  reject_unauthorized: boolean | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_last_uid: number | null;
  email_ignore_senders: string[] | null;
}

export interface ProcessResult {
  scanned: number;
  flagged: number;
  /** Total de emails na janela dos últimos dias (antes do filtro do cursor). */
  windowTotal: number;
  /** Emails que passaram o filtro de publicidade/ignorados e foram à IA. */
  afterFilter: number;
  /** Emails que a IA conseguiu classificar (menos que afterFilter = falha IA). */
  aiCovered: number;
  /** Excerto da resposta crua da IA quando a triagem falhou (diagnóstico). */
  debugSample?: string;
  /** Mensagem de erro do 1.º upsert que falhou (diagnóstico de escrita). */
  writeError?: string;
  /** Lembretes "new" que existem de facto na BD para o consultor (sem RLS). */
  storedNew?: number;
  /** Só definido quando o IMAP falhou (auth/servidor/porta). */
  imapError?: string;
}

/**
 * Processa a caixa de UM consultor: lê, tria e guarda os sinalizados. Não lança
 * em erro de IMAP — devolve-o em `imapError` para o chamador poder mostrá-lo.
 */
export async function processInboxForUser(
  admin: SupabaseClient,
  acc: InboxAccount,
  opts: { maxMessages?: number; ignoreCursor?: boolean } = {},
): Promise<ProcessResult> {
  const host = acc.imap_host || acc.smtp_host;
  if (!host || !acc.smtp_username || !acc.smtp_password) {
    return { scanned: 0, flagged: 0, windowTotal: 0, afterFilter: 0, aiCovered: 0, imapError: "Faltam dados de acesso (servidor/utilizador/palavra-passe)." };
  }

  // No modo manual ("Verificar agora") varremos sempre a janela toda (cursor=0)
  // — o upsert com unique(user_id,message_uid) evita duplicados. O cron mantém-se
  // incremental (a partir do cursor) por custo de IA.
  const lastUid = opts.ignoreCursor ? 0 : acc.imap_last_uid || 0;

  let read;
  try {
    read = await readNewInboxMessages({
      host,
      port: acc.imap_port || 993,
      user: acc.smtp_username,
      pass: acc.smtp_password,
      rejectUnauthorized: acc.reject_unauthorized ?? true,
      lastUid,
      sinceDays: 3,
      maxMessages: opts.maxMessages ?? MAX_MESSAGES_PER_USER,
    });
  } catch (imapError: any) {
    console.error(`[inbox-assistant] IMAP falhou para ${acc.user_id}:`, {
      host,
      port: acc.imap_port || 993,
      user: acc.smtp_username,
      code: imapError?.code,
      authenticationFailed: imapError?.authenticationFailed,
      serverResponseCode: imapError?.serverResponseCode,
      responseText: imapError?.responseText,
      message: imapError?.message,
    });
    return { scanned: 0, flagged: 0, windowTotal: 0, afterFilter: 0, aiCovered: 0, imapError: describeImapError(imapError, host, acc.imap_port || 993) };
  }

  const scanned = read.messages.length;
  const windowTotal = read.totalInWindow;
  let flagged = 0;

  // Descarta publicidade/automáticos e a lista de ignorados do consultor ANTES
  // da IA — não são analisados nem contam para nada.
  const relevant = read.messages.filter(
    (m) => !shouldIgnore(m.fromEmail, acc.email_ignore_senders || []),
  );
  const afterFilter = relevant.length;
  let aiCovered = 0;
  let debugSample: string | undefined;
  let writeError: string | undefined;

  if (relevant.length > 0) {
    // Tria em LOTES pequenos: uma só chamada com dezenas de emails corre o risco
    // de a resposta JSON ser truncada (excede tokens) e falhar toda a triagem.
    const CHUNK = 8;
    const triage: (TriageResult | undefined)[] = [];
    for (let i = 0; i < relevant.length; i += CHUNK) {
      const { results, raw } = await triageBatch(acc.user_id, relevant.slice(i, i + CHUNK));
      for (let j = 0; j < results.length; j++) triage[i + j] = results[j];
      const covered = results.filter(Boolean).length;
      aiCovered += covered;
      // Guarda um excerto da 1.ª resposta que não deu itens, para diagnóstico.
      if (covered === 0 && !debugSample) debugSample = raw.slice(0, 300);
    }

    for (let i = 0; i < relevant.length; i++) {
      const m = relevant[i];
      const t = triage[i];
      if (!t || t.importance === "low") continue;

      // Ligar ao lead quando o remetente é conhecido (só para o link — o email
      // em si não fica guardado).
      let leadId: string | null = null;
      if (m.fromEmail) {
        const { data: lead } = await admin
          .from("leads")
          .select("id")
          .ilike("email", m.fromEmail)
          .or(`assigned_to.eq.${acc.user_id},user_id.eq.${acc.user_id}`)
          .limit(1)
          .maybeSingle();
        leadId = (lead as any)?.id || null;
      }

      const { error: upsertError } = await admin.from("inbox_triage").upsert(
        {
          user_id: acc.user_id,
          message_uid: m.uid,
          from_name: m.fromName,
          importance: t.importance,
          reminder: t.reminder || null,
          advice: t.advice || null,
          agenda_suggestion: t.agendaSuggestion || null,
          lead_id: leadId,
        },
        { onConflict: "user_id,message_uid", ignoreDuplicates: true },
      );
      if (upsertError) {
        if (!writeError) writeError = upsertError.message;
        console.error("[inbox-assistant] Falha ao guardar lembrete:", upsertError);
      }
      flagged++;
    }
  }

  // Avança o cursor para não reprocessar (mesmo os não guardados).
  if (read.highestUid > (acc.imap_last_uid || 0)) {
    await admin
      .from("user_smtp_settings")
      .update({ imap_last_uid: read.highestUid })
      .eq("user_id", acc.user_id);
  }

  // Quantos lembretes "new" existem MESMO na BD para este consultor (via
  // service-role, sem RLS) — separa "não gravou" de "não lê" (RLS/cliente).
  const { count: storedNew } = await admin
    .from("inbox_triage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", acc.user_id)
    .eq("status", "new");

  return { scanned, flagged, windowTotal, afterFilter, aiCovered, debugSample, writeError, storedNew: storedNew ?? 0 };
}
