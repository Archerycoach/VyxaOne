import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import crypto from "crypto";
import { appendSignature } from "@/lib/server/emailSignature";

/**
 * Envio centralizado de emails AUTOMÁTICOS a clientes/leads (sem ação manual
 * direta do consultor): reativação de leads, alertas de contacto/
 * oportunidade, property-matcher e automações/workflows.
 *
 * Concentra num único sítio três coisas que antes estavam duplicadas e
 * inconsistentes entre ficheiros:
 * 1. Envio via SMTP com as definições do consultor.
 * 2. Cópia best-effort na pasta "Sent" do IMAP do consultor (nunca bloqueia
 *    nem falha o envio real do email — se o IMAP falhar, o email já foi
 *    entregue na mesma).
 * 3. Registo em `automated_email_log`, a fonte única para a página de
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
  | "workflow_automation";

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
  imapSaved: boolean;
}

interface SmtpSettingsRow {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  reject_unauthorized: boolean | null;
  from_name: string | null;
  from_email: string;
  imap_host: string | null;
  imap_port: number;
  imap_secure: boolean;
  imap_sent_folder: string;
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

  const { data: smtpSettings } = await supabaseAdmin
    .from("user_smtp_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!smtpSettings?.smtp_host) {
    const error = "SMTP não configurado para este utilizador.";
    await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, status: "failed", errorMessage: error, imapSaved: false });
    return { success: false, error, imapSaved: false };
  }

  const settings = smtpSettings as SmtpSettingsRow;

  const html = params.appendSignatureToHtml === false
    ? params.html
    : await appendSignature(params.html, supabaseAdmin, userId);

  const fromHeader = settings.from_name
    ? `"${settings.from_name}" <${settings.from_email}>`
    : settings.from_email;

  // Fixamos messageId e date para garantirem-se idênticos entre o envio real
  // e a cópia gerada para o IMAP (evita divergências entre o que foi enviado
  // e o que fica arquivado).
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
    await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, status: "failed", errorMessage, imapSaved: false });
    return { success: false, error: errorMessage, imapSaved: false };
  }

  const imapSaved = await tryArchiveInSentFolder(settings, mailOptions);

  await logAutomatedEmail(supabaseAdmin, { userId, leadId, leadName, source, to, subject, status: "sent", imapSaved });

  return { success: true, imapSaved };
}

/**
 * Gera o mesmo email em bruto (sem o enviar) e tenta gravá-lo na pasta Sent
 * do IMAP do consultor. Best-effort: qualquer falha aqui é apenas registada
 * na consola, nunca lançada, porque o email real já foi entregue com sucesso.
 */
async function tryArchiveInSentFolder(
  settings: SmtpSettingsRow,
  mailOptions: BuiltMailOptions
): Promise<boolean> {
  if (!settings.imap_host) return false;

  try {
    const previewTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const previewInfo = await previewTransport.sendMail(mailOptions);
    const rawMessage = previewInfo.message as Buffer;

    const client = new ImapFlow({
      host: settings.imap_host,
      port: settings.imap_port,
      secure: settings.imap_secure,
      auth: {
        user: settings.smtp_username,
        pass: settings.smtp_password,
      },
      logger: false,
    });

    await client.connect();
    try {
      await client.append(settings.imap_sent_folder || "Sent", rawMessage, ["\\Seen"]);
    } finally {
      await client.logout();
    }

    return true;
  } catch (imapError) {
    console.error("[sendClientEmail] Falha ao gravar cópia no IMAP (não bloqueante):", imapError);
    return false;
  }
}

interface LogAutomatedEmailParams {
  userId: string;
  leadId?: string | null;
  leadName?: string | null;
  source: AutomatedEmailSource;
  to: string;
  subject: string;
  status: "sent" | "failed";
  errorMessage?: string;
  imapSaved: boolean;
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
      status: params.status,
      error_message: params.errorMessage || null,
      imap_saved: params.imapSaved,
    });
  } catch (logError) {
    console.error("[sendClientEmail] Falha ao registar em automated_email_log (não bloqueante):", logError);
  }
}
