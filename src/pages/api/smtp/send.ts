import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function normalizeRecipientList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user's SMTP settings
    const { data: smtpSettings, error: settingsError } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (settingsError || !smtpSettings) {
      return res.status(400).json({
        success: false,
        message: "SMTP settings not configured. Please configure SMTP in your user settings.",
      });
    }

    // Get user's profile for email signature
    const { data: profile }: { data: any } = await supabase
      .from("profiles")
      .select("email_signature_text, email_signature_image_url")
      .eq("id", user.id)
      .single();

    const { to, subject, html, text, cc, bcc, attachments, sendCopyToSender } = req.body;
    const { leadId, contactId } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        message: "Missing required email fields (to, subject, and html or text)",
      });
    }

    // Process attachments to ensure they are formatted correctly for nodemailer
    // Nodemailer supports: { filename: 'text1.txt', content: 'aGVsbG8g...!', encoding: 'base64' }
    // Or URL: { filename: 'file.pdf', path: 'https://...' }
    let formattedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      formattedAttachments = attachments.map(att => {
        // If it's a supabase storage URL, we can pass it directly to `path`
        if (att.url || att.path) {
          return {
            filename: att.filename || att.name || 'Anexo',
            path: att.url || att.path
          };
        }
        return att;
      });
    }

    const normalizedCc = normalizeRecipientList(cc);
    const normalizedBcc = normalizeRecipientList(bcc);
    const copyRecipient = user.email || smtpSettings.from_email;
    const finalBcc = sendCopyToSender && copyRecipient
      ? Array.from(new Set([...normalizedBcc, copyRecipient]))
      : normalizedBcc;

    // Build email signature HTML
    let signatureHtml = "";
    if (profile?.email_signature_text || profile?.email_signature_image_url) {
      signatureHtml = '<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">';
      
      if (profile.email_signature_text) {
        const textWithBreaks = profile.email_signature_text.replace(/\n/g, '<br>');
        signatureHtml += `<p style="margin: 0; white-space: pre-wrap;">${textWithBreaks}</p>`;
      }
      
      if (profile.email_signature_image_url) {
        signatureHtml += `<img src="${profile.email_signature_image_url}" alt="Assinatura" style="max-width: 100%; height: auto; margin-top: 10px;">`;
      }
      
      signatureHtml += '</div>';
    }

    // Add signature to HTML content
    const finalHtml = html ? `${html}${signatureHtml}` : signatureHtml;

    // Create transporter with user's SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      secure: smtpSettings.smtp_secure,
      auth: {
        user: smtpSettings.smtp_username,
        pass: smtpSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: smtpSettings.from_name
        ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
        : smtpSettings.from_email,
      to,
      subject,
      text,
      html: finalHtml,
      cc: normalizedCc.length > 0 ? normalizedCc : undefined,
      bcc: finalBcc.length > 0 ? finalBcc : undefined,
      attachments: formattedAttachments.length > 0 ? formattedAttachments : undefined,
    });

    // Log the email as an interaction
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await logEmailInteractionServer(supabaseAdmin, {
      leadId: leadId || undefined,
      contactId: contactId || undefined,
      userId: user.id,
      subject,
      body: html,
      outcome: "Email enviado",
    });

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("SMTP send error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send email",
    });
  }
}