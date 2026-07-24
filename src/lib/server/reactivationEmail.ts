import { runAI } from "@/lib/ai/provider";
import { getReactivationEmailPrompt, pickAngle } from "@/lib/ai/prompts/reactivationEmail";
import { getSignatureHtml } from "@/lib/server/emailSignature";
import crypto from "crypto";

/**
 * Renderização central do email de reativação de leads.
 *
 * É usada TANTO pelo cron real (`/api/cron/lead-reactivation`) COMO pela
 * ferramenta de teste (`/api/reactivation/test-send`), para garantir que o
 * email de teste é byte-a-byte igual ao que a produção envia — incluindo os
 * links de opt-in e unsubscribe.
 *
 * Esta função tem UM efeito colateral intencional: se a lead ainda não tiver
 * `consent_token` / `email_unsub_token`, gera-os e grava-os (para os links
 * funcionarem). Não altera estado de follow-up, tentativas nem datas.
 */

// Objetivo da procura (buy_purpose) em texto português para os emails.
// Os valores internos ("housing"/"investment") nunca podem chegar ao cliente.
const BUY_PURPOSE_LABELS: Record<string, string> = {
  housing: "habitação própria",
  investment: "investimento",
};

export const REACTIVATION_TEMPLATE_BY_ATTEMPT: Record<number, string> = {
  1: "optin_inicial",
  2: "optin_lembrete_2",
  3: "optin_lembrete_final",
};

const OPT_IN_BUTTON_STYLE =
  "display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;";

/**
 * Garante que o link de autorização ({{link_optin}}) tem sempre o aspeto de
 * botão, mesmo que o editor visual de texto tenha removido o estilo original
 * ao guardar a mensagem.
 */
function styleOptInButton(html: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="\{\{link_optin\}\}"([^>]*)>/gi,
    (_match, before: string, after: string) => {
      const cleanedBefore = before.replace(/style="[^"]*"/gi, "").trim();
      const cleanedAfter = after.replace(/style="[^"]*"/gi, "").trim();
      const attrs = [cleanedBefore, `href="{{link_optin}}"`, `style="${OPT_IN_BUTTON_STYLE}"`, cleanedAfter]
        .filter(Boolean)
        .join(" ");
      return `<a ${attrs}>`;
    }
  );
}

export interface ReactivationEmailLead {
  id: string;
  user_id: string;
  name?: string | null;
  consent_token?: string | null;
  email_unsub_token?: string | null;
  location_preference?: string | null;
  buy_purpose?: string | null;
  /** Última atualização, para calcular há quanto tempo não há contacto. */
  updated_at?: string | null;
}

export interface BuiltReactivationEmail {
  subject: string;
  html: string;
  optInUrl: string;
  optOutUrl: string;
  templateName: string;
}

/**
 * Gera o email com IA e monta o HTML final com os links obrigatórios.
 *
 * Devolve null se a IA falhar — quem chama recorre aos templates fixos.
 */
async function buildAiReactivationEmail(params: {
  lead: ReactivationEmailLead;
  attemptNumber: number;
  consultor: string;
  procuraStr: string;
  optInUrl: string;
  optOutUrl: string;
  bookingUrl: string | null;
  anglesUsed: string[];
  isLastEmail: boolean;
  /** Assinatura do consultor, já embutida aqui (sem régua) — o envio não a volta a acrescentar. */
  signatureHtml: string;
}): Promise<{ subject: string; html: string; templateName: string } | null> {
  const {
    lead, attemptNumber, consultor, procuraStr,
    optOutUrl, bookingUrl, anglesUsed, isLastEmail, signatureHtml,
  } = params;

  const angle = pickAngle(anglesUsed, isLastEmail);

  const daysSinceContact = lead.updated_at
    ? Math.max(0, Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 86400000))
    : 30;

  const prompt = getReactivationEmailPrompt({
    leadName: (lead.name || "").split(" ")[0] || "Olá",
    consultantName: consultor,
    searchSummary: procuraStr || "imóvel",
    daysSinceContact,
    anglesUsed,
    angle,
    attemptNumber,
    isLastEmail,
  });

  const aiResponse = await runAI({
    userId: lead.user_id,
    task: "reactivation_email",
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
    temperature: 0.8, // variedade entre emails da mesma sequência
    maxTokens: 800,
  });

  let parsed: any;
  try {
    const match = aiResponse.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : aiResponse.text);
  } catch {
    console.error("[reactivationEmail] JSON inválido da IA:", aiResponse.text.slice(0, 200));
    return null;
  }

  const subject = String(parsed.subject || "").trim();
  const bodyHtml = String(parsed.bodyHtml || "").trim();
  if (!subject || !bodyHtml) return null;

  const ctaLabel = String(parsed.ctaLabel || "Marcar uma conversa").trim();
  const preheader = String(parsed.preheader || "").trim();

  // Os links são acrescentados AQUI, nunca pela IA: o de marcação e o de
  // opt-out têm de estar sempre presentes e corretos, e um modelo pode
  // esquecê-los ou inventar URLs.
  const ctaBlock = bookingUrl
    ? `<p style="margin:24px 0;">
         <a href="${bookingUrl}" style="${OPT_IN_BUTTON_STYLE}">${escapeHtml(ctaLabel)}</a>
       </p>`
    : "";

  // Ordem final: corpo → CTA → assinatura → "deixar de receber".
  // A assinatura vem embutida aqui (sem régua a separá-la do texto) e o
  // "deixar de receber" fica DEPOIS dela, no fim de tudo. Por isso o envio
  // (sendClientEmail) é chamado com appendSignatureToHtml:false — senão a
  // assinatura repetia-se e ficava antes do rodapé.
  const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;line-height:1.6;">
    ${bodyHtml}
    ${ctaBlock}
    ${signatureHtml}
    <p style="font-size:12px;color:#6b7280;margin:32px 0 0;">
      Recebe este email porque manifestou interesse em imóveis.
      <a href="${optOutUrl}" style="color:#6b7280;">Deixar de receber</a>.
    </p>
  </div>
</body>
</html>`;

  return { subject, html, templateName: angle };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Constrói (mas NÃO envia) o email de reativação para uma lead.
 * Devolve `null` se o template correspondente não existir.
 */
export async function buildReactivationEmail(params: {
  supabaseAdmin: any;
  lead: ReactivationEmailLead;
  attemptNumber: number;
  appUrl?: string;
  /** Falso força os templates fixos (por omissão, IA). */
  useAi?: boolean;
  /** Link de marcação do consultor, para o CTA. */
  bookingUrl?: string | null;
  /** Ângulos já usados nesta sequência, para a IA não repetir. */
  anglesUsed?: string[];
  /** Último email da sequência: muda o tom para encerramento. */
  isLastEmail?: boolean;
}): Promise<BuiltReactivationEmail | null> {
  const { supabaseAdmin, lead, attemptNumber } = params;
  const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt";

  // Garantir tokens (para os links funcionarem). Idempotente: só grava se faltar.
  let token = lead.consent_token;
  if (!token) {
    token = crypto.randomUUID();
    await supabaseAdmin.from("leads").update({ consent_token: token }).eq("id", lead.id);
  }

  let emailUnsubToken = lead.email_unsub_token;
  if (!emailUnsubToken) {
    emailUnsubToken = crypto.randomUUID();
    await supabaseAdmin.from("leads").update({ email_unsub_token: emailUnsubToken }).eq("id", lead.id);
  }

  const optInUrl = `${appUrl}/optin/${token}`;
  const optOutUrl = `${appUrl}/unsubscribe/${emailUnsubToken}`;

  // Variáveis do template a partir do perfil do consultor.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", lead.user_id)
    .maybeSingle();

  const consultor = profile?.full_name || "Consultor Imobiliário";
  const empresa = profile?.company_name || "VYXA";

  // Assinatura configurada do consultor, embutida diretamente no email de
  // reativação (em vez de acrescentada no envio), para controlar a ordem:
  // texto → assinatura → "deixar de receber". Removemos a régua superior
  // (border-top) para o texto fluir para a assinatura sem linha a separar.
  const rawSignature = await getSignatureHtml(supabaseAdmin, lead.user_id);
  const signatureHtml = rawSignature.replace("border-top: 1px solid #eaeaea;", "");

  // buy_purpose é guardado com valores internos ("housing"/"investment") — sem
  // esta tradução, o email escrevia "a sua procura de housing", uma palavra em
  // inglês no meio do texto português.
  const procuraType = BUY_PURPOSE_LABELS[(lead.buy_purpose || "").trim()] || "imóvel";
  const procuraLoc = lead.location_preference ? ` em ${lead.location_preference}` : "";
  const procuraStr = `${procuraType}${procuraLoc}`.trim();

  // ── Email escrito pela IA ────────────────────────────────────────────────
  //
  // Preferimos a IA aos templates fixos: cada email da sequência ganha um
  // ângulo diferente (novidade de mercado, pergunta aberta, utilidade
  // prática...), o que evita a repetição que faz uma sequência ser ignorada.
  //
  // Os templates continuam a existir como alternativa: se a IA falhar (sem
  // chave, quota, JSON inválido), o email sai à mesma pelo caminho antigo. Um
  // seguimento não pode deixar de ser enviado por causa da IA.
  if (params.useAi !== false) {
    try {
      const aiEmail = await buildAiReactivationEmail({
        lead,
        attemptNumber,
        consultor,
        procuraStr,
        optInUrl,
        optOutUrl,
        bookingUrl: params.bookingUrl || null,
        anglesUsed: params.anglesUsed || [],
        isLastEmail: Boolean(params.isLastEmail),
        signatureHtml,
      });

      if (aiEmail) {
        return { ...aiEmail, optInUrl, optOutUrl, templateName: `ia:${aiEmail.templateName}` };
      }
    } catch (aiError) {
      console.error("[reactivationEmail] IA falhou; a usar template fixo.", aiError);
    }
  }

  const templateName = REACTIVATION_TEMPLATE_BY_ATTEMPT[attemptNumber] || REACTIVATION_TEMPLATE_BY_ATTEMPT[1];

  // Procura: 1) versão personalizada deste consultor, 2) versão partilhada
  // (user_id null), 3) qualquer registo com este nome (retrocompatibilidade).
  let template: { subject: string; html_body: string } | null = null;

  const { data: ownTemplate } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", templateName)
    .eq("user_id", lead.user_id)
    .maybeSingle();
  template = ownTemplate;

  if (!template) {
    const { data: sharedTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_body")
      .eq("name", templateName)
      .is("user_id", null)
      .maybeSingle();
    template = sharedTemplate;
  }

  if (!template) {
    const { data: anyTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_body")
      .eq("name", templateName)
      .limit(1)
      .maybeSingle();
    template = anyTemplate;
  }

  if (!template) {
    return null;
  }

  // Normalizar o href dos placeholders: o editor visual de texto pode ter
  // "colado" o domínio da instância antes do placeholder (ex.:
  // href="https://siim.vyxa.pt/{{link_optin}}"), o que geraria uma URL dentro de
  // outra ao substituir. Forçamos o href a ser exatamente o placeholder.
  const normalizedBody = template.html_body
    .replace(/href\s*=\s*"[^"]*(\{\{\s*link_optin\s*\}\})[^"]*"/gi, 'href="$1"')
    .replace(/href\s*=\s*"[^"]*(\{\{\s*link_unsubscribe\s*\}\})[^"]*"/gi, 'href="$1"');

  const filledBody = styleOptInButton(normalizedBody)
    .replace(/\{\{nome\}\}/g, lead.name || "Cliente")
    .replace(/\{\{procura\}\}/g, procuraStr)
    .replace(/\{\{consultor\}\}/g, consultor)
    .replace(/\{\{empresa\}\}/g, empresa)
    .replace(/\{\{link_optin\}\}/g, optInUrl)
    .replace(/\{\{link_unsubscribe\}\}/g, optOutUrl);

  // Como o envio é feito com appendSignatureToHtml:false (para a via IA
  // controlar a ordem da assinatura), o fallback tem de embutir a assinatura
  // aqui — senão estes emails sairiam sem assinatura nenhuma.
  const html = signatureHtml ? `${filledBody}${signatureHtml}` : filledBody;

  const subject = template.subject
    .replace(/\{\{nome\}\}/g, lead.name || "Cliente")
    .replace(/\{\{procura\}\}/g, procuraStr);

  return { subject, html, optInUrl, optOutUrl, templateName };
}
