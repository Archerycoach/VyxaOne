import nodemailer from "nodemailer";
import crypto from "crypto";
import { appendSignature } from "@/lib/server/emailSignature";

/**
 * Envio centralizado de emails AUTOMÁTICOS a clientes/leads (sem ação manual
 * direta do consultor): reativação de leads, alertas de contacto/
 * oportunidade, property-matcher e automações/workflows.
 *
 * Concentra num único sítio duas coisas que antes estavam duplicadas e
 * inconsistentes entre ficheiros:
 * 1. Envio via SMTP com as definições do consultor.
 * 2. Registo em `automated_email_log`, a fonte única para a página de
 *    "Emails Automáticos" em Definições.
 *
 * NÃO deve ser usado para emails enviados manualmente por um consultor
 * (Email IA, mensagens em massa) — esses continuam a passar por
 * /api/smtp/send.ts e não entram neste registo, porque já são uma ação
 * visível e intencional de quem os enviou.
 */

export type AutomatedEmailSource =
  | "lead_reactivation"
  | "contact_alerts"
  | "property_matcher"
  | "buyer_match"
  | "workflow_automation"
  | "meta_auto_reply"
  | "booking_confirmation"
  | "landing_monthly_report"
  | "portal_new_property"
  | "portal_invite"
  | "important_date";

export interface EmailAttachment {
  filename?: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

export interface SendClientEmailParams {
  supabaseAdmin: any;
  userId: string;
  leadId?: string | null;
  leadName?: string | null;
  source: AutomatedEmailSource;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** Se false, não aplica a assinatura central (já vem embutida no html). Por defeito true. */
  appendSignatureToHtml?: boolean;
}

export interface SendClientEmailResult {
  success: boolean;
  error?: string;
  /** true quando o envio foi deliberadamente suprimido (opt-out / do_not_contact). */
  suppressed?: boolean;
}

/**
 * Fontes de marketing/distribuição — respeitam o opt-out de email da lead
 * (email_opt_out). As restantes fontes são transacionais (a lead pediu ou
 * espera a mensagem: confirmação de marcação, auto-resposta, portais) e só são
 * bloqueadas pela marca deliberada do_not_contact.
 */
const MARKETING_EMAIL_SOURCES: ReadonlySet<AutomatedEmailSource> = new Set<AutomatedEmailSource>([
  "lead_reactivation",
  "contact_alerts",
  "property_matcher",
  "buyer_match",
  "workflow_automation",
  "landing_monthly_report",
]);

interface SmtpSettingsRow {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  reject_unauthorized: boolean | null;
  from_name: string | null;
  from_email: string;
}

interface BuiltMailOptions {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  messageId: string;
  date: Date;
}

export async function sendClientEmail(params: SendClientEmailParams): Promise<SendClientEmailResult> {
  const { supabaseAdmin, userId, leadId, leadName, source, to, subject } = params;

  // Exclusão de listas de distribuição: antes de enviar qualquer email
  // automático a uma lead, respeitar a marca do_not_contact (bloqueia sempre)
  // e o email_opt_out (bloqueia fontes de marketing/distribuição).
  if (leadId) {
    const { data: leadFlags } = await supabaseAdmin
      .from("leads")
      .select("email_opt_out, do_not_contact")
      .eq("id", leadId)
      .maybeSingle();

    const doNotContact = !!leadFlags?.do_not_contact;
    const emailOptOut = !!leadFlags?.email_opt_out;

    if (doNotContact || (emailOptOut && MARKETING_EMAIL_SOURCES.has(source))) {
      const reason = doNotContact
        ? "Suprimido: lead marcada como 'não contactar' (do_not_contact)."
        : "Suprimido: lead com opt-out de email (excluída de listas de distribuição).";
      await logAutomatedEmail(supabaseAdmin, {
        userId, leadId, leadName, source, to, subject, htmlBody: params.html,
        status: "suppressed", errorMessage: reason,
      });
      return { success: false, error: reason, suppressed: true };
    }
  }

  const { data: smtpSettings } = await supabaseAdmin
    .from("user_smtp_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!smtpSettings?.smtp_host) {
    const error = "SMTP não configurado para este utilizador.";
    await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, htmlBody: params.html, status: "failed", errorMessage: error });
    return { success: false, error };
  }

  const settings = smtpSettings as SmtpSettingsRow;

  const html = params.appendSignatureToHtml === false
    ? params.html
    : await appendSignature(params.html, supabaseAdmin, userId);

  const fromHeader = settings.from_name
    ? `"${settings.from_name}" <${settings.from_email}>`
    : settings.from_email;

  // Message-ID e date explícitos para o email levar cabeçalhos próprios estáveis.
  const domain = settings.from_email.split("@")[1] || "vyxa.pt";
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const date = new Date();

  const mailOptions: BuiltMailOptions = {
    from: fromHeader,
    to,
    cc: params.cc,
    subject,
    html,
    text: params.text,
    attachments: params.attachments,
    messageId,
    date,
  };

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure,
    auth: {
      user: settings.smtp_username,
      pass: settings.smtp_password,
    },
    tls: { rejectUnauthorized: settings.reject_unauthorized ?? true },
  });

  try {
    await transporter.sendMail(mailOptions);
  } catch (sendError: any) {
    const errorMessage = sendError?.message || "Falha ao enviar email";
    await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, htmlBody: html, status: "failed", errorMessage });
    return { success: false, error: errorMessage };
  }

  await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, htmlBody: html, status: "sent" });

  return { success: true };
}

interface LogAutomatedEmailParams {
  userId: string;
  leadId?: string | null;
  leadName?: string | null;
  source: AutomatedEmailSource;
  to: string;
  subject: string;
  htmlBody?: string;
  status: "sent" | "failed" | "suppressed";
  errorMessage?: string;
}

async function logAutomatedEmail(supabaseAdmin: any, params: LogAutomatedEmailParams): Promise<void> {
  try {
    await supabaseAdmin.from("automated_email_log").insert({
      user_id: params.userId,
      lead_id: params.leadId || null,
      lead_name: params.leadName || null,
      source: params.source,
      to_email: params.to,
      subject: params.subject,
      html_body: params.htmlBody || null,
      status: params.status,
      error_message: params.errorMessage || null,
    });
  } catch (logError) {
    console.error("[sendClientEmail] Falha ao registar em automated_email_log (não bloqueante):", logError);
  }
}
