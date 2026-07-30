import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { readNewInboxMessages, type InboxMessage } from "@/lib/server/inboxReader";
import { runAI } from "@/lib/ai/provider";

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
 * Corre a cada ~10-15 min (ver vercel.json). Protegido pelo CRON_SECRET.
 */

const MAX_USERS_PER_RUN = 25;
const MAX_MESSAGES_PER_USER = 40;

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
function shouldIgnore(fromEmail: string | null, ignoreList: string[]): boolean {
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
 * cópia dos emails). O conteúdo é lido aqui, analisado e descartado — só o
 * conselho volta para ser guardado.
 */
async function triageBatch(userId: string, messages: InboxMessage[]): Promise<TriageResult[]> {
  const list = messages.map((m, i) => ({
    i,
    de: m.fromName || m.fromEmail || "remetente desconhecido",
    assunto: m.subject || "(sem assunto)",
    excerto: (m.text || "").slice(0, 800),
  }));

  const prompt = `És o assistente de um consultor imobiliário. Lês a caixa de entrada dele e transformas o que importa em LEMBRETES e CONSELHOS práticos. NÃO resumas a caixa toda — só o que exige atenção ou ação (resposta de cliente/lead, pergunta, objeção, pedido de visita/proposta, prazo, oportunidade). Ignora newsletters, promoções, notificações automáticas e spam.

Para CADA email, devolve:
- importance: "high" (precisa de ação hoje/amanhã), "medium" (a acompanhar), "low" (nada a fazer — ignora-se).
- reminder: UMA frase com o que precisa de atenção, dirigida ao consultor (ex.: "A Maria pergunta se pode visitar o T3 este fim de semana.").
- advice: conselho curto de COMO tratar e responder (tom, o que dizer, o que confirmar). Ex.: "Confirma a disponibilidade dela e propõe dois horários; reforça que o imóvel tem tido procura.".
- agendaSuggestion: conselho de AGENDA/timing (ex.: "Responder hoje ao fim do dia; marcar a visita para sábado de manhã."), ou "" se não aplicável.

EMAILS (JSON):
${JSON.stringify(list)}

Responde APENAS com um array JSON, na MESMA ordem e com o mesmo tamanho, cada item:
{ "importance": "...", "reminder": "...", "advice": "...", "agendaSuggestion": "..." }`;

  const response = await runAI({
    userId,
    task: "inbox_triage",
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
    temperature: 0.3,
  });

  try {
    const cleaned = response.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (Array.isArray(parsed)) return parsed as TriageResult[];
  } catch (error) {
    console.error("[inbox-assistant] Conselhos IA sem JSON válido:", error);
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const deadline = Date.now() + 50_000;

  try {
    const { data: accounts } = await admin
      .from("user_smtp_settings")
      .select("user_id, smtp_host, smtp_username, smtp_password, reject_unauthorized, imap_host, imap_port, imap_last_uid, email_assistant_enabled, email_ignore_senders")
      .eq("email_assistant_enabled", true)
      .limit(MAX_USERS_PER_RUN);

    let flagged = 0;
    let scanned = 0;

    for (const acc of (accounts as any[]) || []) {
      if (Date.now() > deadline) break;

      const host = acc.imap_host || acc.smtp_host;
      if (!host || !acc.smtp_username || !acc.smtp_password) continue;

      let read;
      try {
        read = await readNewInboxMessages({
          host,
          port: acc.imap_port || 993,
          user: acc.smtp_username,
          pass: acc.smtp_password,
          rejectUnauthorized: acc.reject_unauthorized ?? true,
          lastUid: acc.imap_last_uid || 0,
          sinceDays: 3,
          maxMessages: MAX_MESSAGES_PER_USER,
        });
      } catch (imapError) {
        console.error(`[inbox-assistant] IMAP falhou para ${acc.user_id}:`, imapError);
        continue;
      }

      scanned += read.messages.length;

      // Descarta publicidade/automáticos e a lista de ignorados do consultor
      // ANTES da IA — não são analisados nem contam para nada.
      const relevant = read.messages.filter(
        (m) => !shouldIgnore(m.fromEmail, acc.email_ignore_senders || []),
      );

      if (relevant.length > 0) {
        const triage = await triageBatch(acc.user_id, relevant);

        // Só se guardam os LEMBRETES dos que merecem atenção — nunca o email
        // (assunto/corpo). O conteúdo já foi lido e é descartado aqui.
        for (let i = 0; i < relevant.length; i++) {
          const m = relevant[i];
          const t = triage[i];
          if (!t || t.importance === "low") continue;

          // Ligar ao lead quando o remetente é conhecido (só para o link — o
          // email em si não fica guardado).
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

          await admin
            .from("inbox_triage")
            .upsert(
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
    }

    return res.status(200).json({ success: true, scanned, flagged });
  } catch (error: any) {
    console.error("[inbox-assistant] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro no assistente de emails" });
  }
}
