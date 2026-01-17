import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate CRON secret token
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.CRON_SECRET_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Eduardo's SMTP settings
    const { data: smtpSettings, error: smtpError } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", (await supabase
        .from("profiles")
        .select("id")
        .eq("email", "eduardotsantos@remax.pt")
        .single()).data?.id)
      .eq("is_active", true)
      .single();

    if (smtpError || !smtpSettings) {
      return res.status(400).json({
        error: "SMTP settings not found",
        details: smtpError,
      });
    }

    // Log configuration for debugging
    console.log("SMTP Config:", {
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      secure: smtpSettings.smtp_secure,
      rejectUnauthorized: smtpSettings.reject_unauthorized,
    });

    // Create transporter with EXACT same config as /api/smtp/send.ts
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

    // Test email
    const info = await transporter.sendMail({
      from: smtpSettings.from_name
        ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
        : smtpSettings.from_email,
      to: "eduardotsantos@remax.pt",
      subject: "🧪 Teste SMTP via CRON API",
      html: `
        <h1>✅ Teste de Email SMTP</h1>
        <p>Este email foi enviado via API CRON para testar a configuração SMTP.</p>
        <p><strong>Servidor:</strong> ${smtpSettings.smtp_host}:${smtpSettings.smtp_port}</p>
        <p><strong>SSL:</strong> ${smtpSettings.smtp_secure ? "Ativo" : "Inativo"}</p>
        <p><strong>Reject Unauthorized:</strong> ${smtpSettings.reject_unauthorized}</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-PT")}</p>
      `,
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      config: {
        host: smtpSettings.smtp_host,
        port: smtpSettings.smtp_port,
        secure: smtpSettings.smtp_secure,
        rejectUnauthorized: smtpSettings.reject_unauthorized,
      },
    });
  } catch (error) {
    console.error("SMTP Test Error:", error);
    return res.status(500).json({
      error: "SMTP test failed",
      message: error instanceof Error ? error.message : "Unknown error",
      details: error,
    });
  }
}