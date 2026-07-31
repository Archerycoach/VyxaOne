import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readNewInboxMessages, type InboxMessage } from "@/lib/server/inboxReader";
import { runAI } from "@/lib/ai/provider";

/** Identificador PSEUDONIMIZADO do remetente (hash do email, não o email). */
function senderHash(email: string | null): string | null {
  const e = (email || "").toLowerCase().trim();
  if (!e) return null;
  return createHash("sha256").update(e).digest("hex");
}

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
  urgency: number; // 1..5 (5 = ação imediata)
  intent: string;  // visita | proposta | pergunta | documento | agendamento | negociacao | nova_lead | outro
  reminder: string;
  advice: string;
  agendaSuggestion: string;
  /** Data CONCRETA (YYYY-MM-DD) quando o email pede contacto/ação numa altura
   *  específica ("liguem-me no fim de setembro") — senão "". */
  agendaDate: string;
}

const INTENTS = ["visita", "proposta", "pergunta", "documento", "agendamento", "negociacao", "nova_lead", "outro"];

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
    let urgency = Number(item.urgency);
    if (!Number.isFinite(urgency)) urgency = 2;
    urgency = Math.max(1, Math.min(5, Math.round(urgency)));
    const intent = typeof item.intent === "string" && INTENTS.includes(item.intent) ? item.intent : "outro";
    const agendaDate =
      typeof item.agendaDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.agendaDate)
        ? item.agendaDate
        : "";
    results[pos] = {
      urgency,
      intent,
      reminder: item.reminder || "",
      advice: item.advice || "",
      agendaSuggestion: item.agendaSuggestion || "",
      agendaDate,
    };
  });
  return results;
}

/** Item já enriquecido (identidade + contexto de lead + histórico) para a IA. */
interface TriageInput {
  i: number;
  de: string;
  assunto: string;
  excerto: string;
  /** "lead conhecida" | "contacto conhecido" | "notificação de portal" | "desconhecido". */
  remetente: string;
  /** Histórico da lead conhecida (estado, último contacto, notas…), se houver. */
  contextoLead?: string;
  /** O que o consultor costuma fazer com este remetente (tratado/ignorado). */
  historicoRemetente?: string;
}

async function triageBatch(userId: string, items: TriageInput[], style: string): Promise<TriageBatchOutcome> {
  const styleLine = style && style.trim()
    ? `\n\nESTILO DE RESPOSTA DO CONSULTOR (adapta o campo "advice" a este tom/estilo): ${style.trim()}`
    : "";

  const prompt = `És o assistente de um consultor imobiliário. Avalias cada email da caixa de entrada e devolves, para cada um, um nível de URGÊNCIA, a INTENÇÃO, e conselhos práticos. Sê RIGOROSO: a maioria dos emails NÃO é urgente. Só sobem de nível os que pedem uma resposta/ação de uma pessoa real.

RUBRICA DE URGÊNCIA (1 a 5):
- 5: pede ação hoje (proposta/decisão a expirar, visita para as próximas horas, cliente à espera de resposta urgente).
- 4: resposta de cliente/lead que espera resposta em 1-2 dias (pergunta, pedido de visita, negociação).
- 3: a acompanhar esta semana (interesse, follow-up, documento a tratar sem pressa).
- 2: informativo, pode esperar/arquivar (confirmações, recibos, avisos).
- 1: irrelevante/automático/publicidade (newsletter, promoção, notificação de sistema).

REGRAS:
- Um email de "lead conhecida" ou "contacto conhecido" que faça uma pergunta ou peça algo NUNCA é inferior a 4.
- "notificação de portal" (Idealista, Imovirtual, etc.) que traga um NOVO contacto/pedido de informação é urgência 4-5 e intenção "nova_lead".
- Newsletters, promoções, notificações automáticas e recibos são urgência 1-2, mesmo que "pareçam" importantes.

INTENÇÃO (escolhe uma): visita, proposta, pergunta, documento, agendamento, negociacao, nova_lead, outro.

Para CADA email devolve:
- urgency: número 1-5 (rubrica acima).
- intent: uma das intenções.
- reminder: UMA frase do que precisa de atenção, dirigida ao consultor.
- advice: conselho curto de COMO tratar e responder.
- agendaSuggestion: conselho de AGENDA/timing, ou "" se não aplicável.
- agendaDate: se o email pedir contacto/ação numa ALTURA CONCRETA (ex.: "liguem-me no fim de setembro", "só depois das férias em agosto"), converte para UMA data concreta futura no formato YYYY-MM-DD (hoje é ${new Date().toISOString().slice(0, 10)}; "fim do mês X" = dia 28 desse mês; "início" = dia 2). Senão "".

USA os campos de cada email quando presentes: "remetente" (identidade), "contextoLead" (histórico da lead — personaliza e não repitas o já feito), "historicoRemetente" (se o consultor costuma IGNORAR este remetente, baixa a urgência salvo sinal claro; se costuma TRATAR, sobe).${styleLine}

EMAILS (JSON):
${JSON.stringify(items)}

Responde APENAS com um objeto JSON com a chave "items" — um item por email, com o mesmo "i" do email de entrada:
{"items":[{"i":0,"urgency":1,"intent":"outro","reminder":"...","advice":"...","agendaSuggestion":"...","agendaDate":""}]}`;

  const response = await runAI({
    userId,
    task: "inbox_triage",
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 4000,
  });

  const raw = response.text || "";
  const results = parseTriage(raw, items.length);
  if (results.every((r) => !r)) {
    console.error("[inbox-assistant] Triagem sem itens válidos:", {
      emails: items.length,
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
  /** Perfil de tom/estilo de resposta do consultor (aprendizagem #3). */
  inbox_reply_style?: string | null;
}

/** Contexto resumido de uma lead conhecida, para informar o conselho da IA. */
async function loadLeadContext(
  admin: SupabaseClient,
  userId: string,
  fromEmail: string,
): Promise<{ leadId: string; context: string } | null> {
  const { data: lead } = await admin
    .from("leads")
    .select("id, name, status, temperature, last_contact_date, next_follow_up, notes")
    .ilike("email", fromEmail)
    .or(`assigned_to.eq.${userId},user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  const l = lead as any;
  if (!l?.id) return null;

  const parts: string[] = [];
  if (l.status) parts.push(`estado=${l.status}`);
  if (l.temperature) parts.push(`temperatura=${l.temperature}`);
  if (l.last_contact_date) parts.push(`último contacto=${String(l.last_contact_date).slice(0, 10)}`);
  if (l.next_follow_up) parts.push(`próximo follow-up=${String(l.next_follow_up).slice(0, 10)}`);
  if (l.notes) parts.push(`notas="${String(l.notes).slice(0, 240)}"`);

  return { leadId: l.id, context: parts.join("; ") || "lead conhecida, sem detalhes" };
}

// Domínios/marcas de portais imobiliários e fontes de leads — as suas
// notificações vêm muitas vezes de noreply@/info@ e SÃO leads. Não podem ser
// tratadas como publicidade.
const PORTAL_HINTS = [
  "idealista", "imovirtual", "casa.sapo", "casasapo", "sapo.pt", "custojusto",
  "green-acres", "greenacres", "bpiexpressoimobiliario", "facebookmail", "fbmail",
  "kwportugal", "remax", "era.pt", "supercasa", "trovit", "properstar",
];

export type SenderKind = "lead" | "contact" | "portal" | "unknown";

const SENDER_KIND_LABEL: Record<SenderKind, string> = {
  lead: "lead conhecida",
  contact: "contacto conhecido",
  portal: "notificação de portal (possível nova lead)",
  unknown: "desconhecido",
};

/**
 * Classifica o remetente: portal (por domínio/marca), lead ou contacto conhecido
 * (por email), ou desconhecido. Remetentes conhecidos/portais NÃO são pré-
 * filtrados como publicidade e ganham prioridade na rubrica.
 */
async function classifySender(
  admin: SupabaseClient,
  userId: string,
  fromEmail: string | null,
): Promise<{ kind: SenderKind; leadId?: string; context?: string }> {
  const email = (fromEmail || "").toLowerCase().trim();
  if (!email) return { kind: "unknown" };

  if (PORTAL_HINTS.some((h) => email.includes(h))) {
    return { kind: "portal" };
  }

  const lead = await loadLeadContext(admin, userId, email);
  if (lead) return { kind: "lead", leadId: lead.leadId, context: lead.context };

  const { data: contact } = await admin
    .from("contacts")
    .select("id, name")
    .ilike("email", email)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if ((contact as any)?.id) {
    return { kind: "contact", context: `contacto conhecido: ${(contact as any).name || "sem nome"}` };
  }

  return { kind: "unknown" };
}

/** Pista textual do que o consultor costuma fazer com um remetente. */
function senderHistoryHint(stat: { handled_count: number; dismissed_count: number } | undefined): string | undefined {
  if (!stat) return undefined;
  const { handled_count: h, dismissed_count: d } = stat;
  if (h === 0 && d === 0) return undefined;
  if (d > 0 && h === 0) return `o consultor já ignorou ${d} email(s) deste remetente e nunca agiu`;
  if (h > 0 && d === 0) return `o consultor costuma tratar emails deste remetente (${h} tratado(s))`;
  return `histórico deste remetente: ${h} tratado(s), ${d} ignorado(s)`;
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

  // --- IDENTIDADE DO REMETENTE (antes de tudo) --------------------------------
  // Classifica cada remetente (lead/contacto/portal/desconhecido), sem repetir
  // consultas (cache por email). Remetentes CONHECIDOS ou de PORTAL nunca são
  // pré-filtrados como publicidade — é aí que escapavam leads reais.
  const uniqueEmails = Array.from(
    new Set((read.messages as InboxMessage[]).map((m) => (m.fromEmail || "").toLowerCase()).filter(Boolean)),
  ) as string[];
  const clsEntries = await Promise.all(
    uniqueEmails.map(async (e) => [e, await classifySender(admin, acc.user_id, e)] as const),
  );
  const clsMap = new Map(clsEntries);
  const classOf = (m: InboxMessage) =>
    clsMap.get((m.fromEmail || "").toLowerCase()) || { kind: "unknown" as SenderKind };

  // Filtro: só descarta ANTES da IA os DESCONHECIDOS que pareçam publicidade ou
  // estejam na lista de ignorados. Conhecidos/portais passam sempre.
  const kept = read.messages
    .map((m) => ({ m, cls: classOf(m) }))
    .filter(({ m, cls }) => cls.kind !== "unknown" || !shouldIgnore(m.fromEmail, acc.email_ignore_senders || []));
  const relevant = kept.map((k) => k.m);
  const relClass = kept.map((k) => k.cls);
  const afterFilter = relevant.length;
  let aiCovered = 0;
  let debugSample: string | undefined;
  let writeError: string | undefined;

  if (relevant.length > 0) {
    const hashes = relevant.map((m) => senderHash(m.fromEmail));

    // Estatísticas de decisões por remetente (aprendizagem com Tratado/Ignorar).
    const uniqueHashes = Array.from(new Set(hashes.filter(Boolean) as string[]));
    const statsMap = new Map<string, { handled_count: number; dismissed_count: number }>();
    if (uniqueHashes.length > 0) {
      const { data: stats } = await admin
        .from("inbox_sender_stats")
        .select("sender_hash, handled_count, dismissed_count")
        .eq("user_id", acc.user_id)
        .in("sender_hash", uniqueHashes);
      (stats as any[] | null)?.forEach((s) =>
        statsMap.set(s.sender_hash, { handled_count: s.handled_count, dismissed_count: s.dismissed_count }),
      );
    }

    const style = acc.inbox_reply_style || "";

    const buildInput = (m: InboxMessage, localIndex: number, globalIndex: number): TriageInput => ({
      i: localIndex,
      de: m.fromName || m.fromEmail || "remetente desconhecido",
      assunto: m.subject || "(sem assunto)",
      excerto: (m.text || "").slice(0, 800),
      remetente: SENDER_KIND_LABEL[relClass[globalIndex].kind],
      contextoLead: relClass[globalIndex].context,
      historicoRemetente: senderHistoryHint(hashes[globalIndex] ? statsMap.get(hashes[globalIndex]!) : undefined),
    });

    // Tria em LOTES pequenos (evita truncagem do JSON).
    const CHUNK = 8;
    const triage: (TriageResult | undefined)[] = [];
    for (let i = 0; i < relevant.length; i += CHUNK) {
      const chunk = relevant.slice(i, i + CHUNK);
      const items = chunk.map((m, j) => buildInput(m, j, i + j));
      const { results, raw } = await triageBatch(acc.user_id, items, style);
      for (let j = 0; j < results.length; j++) triage[i + j] = results[j];
      const covered = results.filter(Boolean).length;
      aiCovered += covered;
      if (covered === 0 && !debugSample) debugSample = raw.slice(0, 300);
    }

    // --- CAPTURA de emails de LEADS (decisão do operador, 2026-07-31) -------
    // Emails de leads conhecidas são SEMPRE registados na ficha da lead como
    // interação "Email recebido" (com cópia do texto), e quando a lead pede
    // contacto numa data concreta cria-se um evento ai_pending na agenda (o
    // consultor confirma/rejeita, como nos eventos da análise automática).
    // Dedupe por uid em inbox_email_log — o "Verificar agora" re-analisa a
    // mesma janela sem duplicar registos. Remetentes desconhecidos continuam
    // sem qualquer captura (minimização).
    for (let i = 0; i < relevant.length; i++) {
      const m = relevant[i];
      const cls = relClass[i];
      if (cls.kind !== "lead" || !cls.leadId) continue;

      // Reivindica o uid: só quem inserir a linha regista (evita duplicados).
      const { data: claimed } = await admin
        .from("inbox_email_log")
        .upsert(
          { user_id: acc.user_id, message_uid: m.uid },
          { onConflict: "user_id,message_uid", ignoreDuplicates: true },
        )
        .select("message_uid");
      if (!claimed || claimed.length === 0) continue;

      const { error: interactionError } = await admin.from("interactions").insert({
        interaction_type: "email",
        interaction_date: m.receivedAt || new Date().toISOString(),
        outcome: "Email recebido",
        subject: m.subject || "(sem assunto)",
        content: `De: ${m.fromName || ""} <${m.fromEmail || ""}>\nAssunto: ${m.subject || "(sem assunto)"}\n\n${m.text || ""}`,
        user_id: acc.user_id,
        lead_id: cls.leadId,
      });
      if (interactionError) {
        console.error("[inbox-assistant] Falha a registar interação de email recebido:", interactionError);
      }

      // Evento na agenda quando a lead pediu contacto numa data concreta.
      const t0 = triage[i];
      if (t0?.agendaDate && new Date(`${t0.agendaDate}T00:00:00Z`).getTime() > Date.now() - 86400000) {
        const { error: eventError } = await admin.from("calendar_events").insert({
          user_id: acc.user_id,
          lead_id: cls.leadId,
          title: `Contactar ${m.fromName || "lead"} (pedido por email)`,
          description: t0.reminder || t0.agendaSuggestion || null,
          event_type: "call",
          start_time: `${t0.agendaDate}T09:00:00Z`,
          end_time: `${t0.agendaDate}T09:30:00Z`,
          ai_pending: true,
        });
        if (eventError) {
          console.error("[inbox-assistant] Falha a criar evento de agenda:", eventError);
        }
      }
    }

    for (let i = 0; i < relevant.length; i++) {
      const m = relevant[i];
      const t = triage[i];
      if (!t) continue;

      const cls = relClass[i];
      const known = cls.kind === "lead" || cls.kind === "contact";

      // CALIBRAÇÃO "equilibrada": leads/contactos conhecidos aparecem SEMPRE;
      // os restantes (incl. portais e desconhecidos) só a partir de urgência 3.
      if (!known && t.urgency < 3) continue;

      // Importância derivada da urgência; conhecidos nunca ficam abaixo de "medium".
      let importance: "high" | "medium" | "low" =
        t.urgency >= 4 ? "high" : t.urgency === 3 ? "medium" : "low";
      if (known && importance === "low") importance = "medium";

      const { error: upsertError } = await admin.from("inbox_triage").upsert(
        {
          user_id: acc.user_id,
          message_uid: m.uid,
          from_name: m.fromName,
          sender_hash: hashes[i],
          sender_kind: cls.kind,
          urgency: t.urgency,
          intent: t.intent,
          importance,
          reminder: t.reminder || null,
          advice: t.advice || null,
          agenda_suggestion: t.agendaSuggestion || null,
          lead_id: cls.leadId || null,
          // Cópia do email SÓ para leads conhecidas (decisão do operador) —
          // permite "Ver email recebido" no assistente.
          email_subject: cls.kind === "lead" ? m.subject || null : null,
          email_body: cls.kind === "lead" ? m.text || null : null,
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
