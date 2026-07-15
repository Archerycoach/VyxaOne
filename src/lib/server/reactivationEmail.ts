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
}

export interface BuiltReactivationEmail {
  subject: string;
  html: string;
  optInUrl: string;
  optOutUrl: string;
  templateName: string;
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

  const procuraType = lead.buy_purpose || "imóvel";
  const procuraLoc = lead.location_preference ? ` em ${lead.location_preference}` : "";
  const procuraStr = `${procuraType}${procuraLoc}`.trim();

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

  const html = styleOptInButton(template.html_body)
    .replace(/\{\{nome\}\}/g, lead.name || "Cliente")
    .replace(/\{\{procura\}\}/g, procuraStr)
    .replace(/\{\{consultor\}\}/g, consultor)
    .replace(/\{\{empresa\}\}/g, empresa)
    .replace(/\{\{link_optin\}\}/g, optInUrl)
    .replace(/\{\{link_unsubscribe\}\}/g, optOutUrl);

  const subject = template.subject
    .replace(/\{\{nome\}\}/g, lead.name || "Cliente")
    .replace(/\{\{procura\}\}/g, procuraStr);

  return { subject, html, optInUrl, optOutUrl, templateName };
}
