import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

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

    // Get user's SMTP settings (removed is_active restriction to prevent false negatives)
    const { data: smtpSettings, error: settingsError } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (settingsError || !smtpSettings) {
      console.error("Error fetching SMTP settings for user", user.id, ":", settingsError);
      return res.status(400).json({
        success: false,
        message: "As definições de SMTP não foram encontradas. Por favor, guarde-as novamente nas suas definições.",
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
    // Por defeito, o endpoint acrescenta a assinatura configurada nas definições.
    // Só não a acrescenta se o chamador passar appendSignature: false.
    const appendSignature = req.body.appendSignature !== false;

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

    // Montar o HTML final com a assinatura (uma só fonte: as definições).
    // A assinatura (email_signature_text) já é HTML formatado — inserimo-la tal
    // como está, sem lhe mexer. Assim TODOS os emails que passam por aqui
    // (manuais, IA, automações, crons) usam a mesma assinatura, de forma consistente.
    let finalHtml = html;
    if (appendSignature && finalHtml && profile && (profile.email_signature_text || profile.email_signature_image_url)) {
      let sigHtml = '<br><br><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eaeaea;">';
      if (profile.email_signature_text) {
        sigHtml += profile.email_signature_text;
      }
      if (profile.email_signature_image_url) {
        sigHtml += `<br><img src="${profile.email_signature_image_url}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
      }
      sigHtml += "</div>";
      finalHtml = finalHtml + sigHtml;
    }

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

    try {
      await logEmailInteractionServer(supabaseAdmin, {
        leadId: leadId || undefined,
        contactId: contactId || undefined,
        userId: user.id,
        to: to,
        subject,
        body: html,
        outcome: "Email enviado",
      });
    } catch (logError) {
      console.error("Failed to log email interaction, but email was sent:", logError);
    }

    // ✅ Auto-create email interaction if sent to a lead
    try {
      // Try to find lead by email
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("email", to)
        .eq("user_id", user.id)
        .maybeSingle();

      if (lead) {
        await createEmailInteraction(lead.id, user.id, subject, html || text, supabaseAdmin);
      }
    } catch (interactionError) {
      console.error("Failed to create email interaction:", interactionError);
      // Don't fail the email send if interaction creation fails
    }

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

/**
 * Helper: Create email interaction and update lead last_contact_date
 * Includes duplicate check to prevent duplicate entries
 */
async function createEmailInteraction(
  leadId: string,
  userId: string,
  subject: string,
  content: string,
  supabaseClient: any
): Promise<void> {
  // Check for duplicate interaction in the last 10 seconds
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  
  const { data: recentInteractions } = await supabaseClient
    .from("interactions")
    .select("id")
    .eq("lead_id", leadId)
    .eq("interaction_type", "email")
    .gte("created_at", tenSecondsAgo)
    .limit(1);

  if (recentInteractions && recentInteractions.length > 0) {
    console.log("Skipping duplicate email interaction creation");
    return;
  }

  // Create interaction with subject in the content
  const interactionContent = `${subject}\n\n${content}`;
  
  const { error: interactionError } = await supabaseClient
    .from("interactions")
    .insert({
      lead_id: leadId,
      user_id: userId,
      interaction_type: "email",
      content: interactionContent,
      subject: subject,
      interaction_date: new Date().toISOString(),
      outcome: "sent"
    });

  if (interactionError) {
    console.error("Error creating email interaction:", interactionError);
    throw interactionError;
  }

  // Update lead's last_contact_date
  const { error: leadUpdateError } = await supabaseClient
    .from("leads")
    .update({ 
      last_contact_date: new Date().toISOString(),
      last_contact_outcome: "sent"
    })
    .eq("id", leadId);

  if (leadUpdateError) {
    console.error("Error updating lead last_contact_date:", leadUpdateError);
  }

  console.log("✅ Email interaction auto-created and lead updated");
}