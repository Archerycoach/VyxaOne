import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const { to, subject, html, text, cc, bcc, attachments } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        message: "Missing required email fields (to, subject, and html or text)",
      });
    }

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
      html,
      cc,
      bcc,
      attachments,
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