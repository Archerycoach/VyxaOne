/**
 * Server-only module for Meta lead post-creation pipeline
 * NEVER import this in browser code - uses service-role and nodemailer
 */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { runLeadWorkflows } from "./workflowEngine";

interface RunPipelineParams {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    lead_type?: string;
  };
  appUrl: string;
  leadFields?: Record<string, string>;
  isExistingLead?: boolean;
}

/**
 * Run complete post-creation pipeline for new Meta leads
 * Executes in order: email notification → workflows (all actions) → AI matcher → Notion sync
 */
export async function runNewLeadPipeline({
  supabase,
  userId,
  lead,
  appUrl,
  leadFields = {},
  isExistingLead = false,
}: RunPipelineParams): Promise<void> {
  console.log(`[Lead Pipeline] Starting pipeline for lead ${lead.id}`);

  // 1. Send lead notification email to consultant
  await sendLeadNotificationEmail(
    supabase,
    userId,
    lead,
    leadFields,
    isExistingLead,
    appUrl
  );

  // 2. ✅ Execute ALL workflows (email, WhatsApp, tasks, calendar, notifications) with anti-duplication
  const workflowResult = await runLeadWorkflows({
    supabase,
    userId,
    leadId: lead.id,
    triggerType: "meta_lead_created",
  });

  if (!workflowResult.success) {
    console.error(`[Lead Pipeline] ⚠️ Workflow errors:`, workflowResult.errors);
    // Log errors to notifications for visibility
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "⚠️ Falha em Automações Meta",
      message: `Algumas automações falharam para a lead ${lead.name}: ${workflowResult.errors.join(", ")}`,
      notification_type: "warning",
      is_read: false,
      related_entity_id: lead.id,
      related_entity_type: "lead",
    } as any);
  }

  // 3. AI Property Matcher (only for buyers)
  if (lead.lead_type === "buyer" || lead.lead_type === "both") {
    try {
      fetch(`${appUrl}/api/gpt/agents/property-matcher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, userId }),
      }).catch((e) => console.error("Async AI Property Matcher failed:", e));
      console.log("🤖 Triggered AI Property Matcher");
    } catch (error) {
      console.error("❌ Failed to trigger AI Property Matcher:", error);
    }
  }

  // 4. Notion sync
  try {
    await fetch(`${appUrl}/api/notion/sync-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, userId }),
    });
    console.log("🔄 Triggered Notion sync");
  } catch (error) {
    console.error("❌ Failed to trigger Notion sync:", error);
  }

  console.log(`[Lead Pipeline] ✅ Pipeline completed for lead ${lead.id}`);
}

/**
 * Send email notification to consultant about new lead
 */
async function sendLeadNotificationEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  lead: any,
  leadFields: Record<string, string>,
  isExisting: boolean,
  appUrl: string
): Promise<void> {
  try {
    // Get user email and profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    const profile = profileData as any;

    if (!profile) {
      console.error("User profile not found");
      return;
    }

    if (!profile.email) {
      console.error("User email not found");
      return;
    }

    // Get SMTP settings
    const { data: smtpData } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    const smtpSettings = smtpData as any;

    if (!smtpSettings) {
      console.log("SMTP not configured for user, skipping email");
      return;
    }

    // Build email content
    const fieldsHtml = Object.entries(leadFields)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join("");

    const title = isExisting
      ? "🔄 Lead Existente Submeteu Novo Formulário"
      : "🎯 Nova Lead Recebida da Meta!";
    const description = isExisting
      ? "Uma lead que já existia no sistema submeteu um novo formulário nas suas campanhas Meta. Os dados foram adicionados como uma nota à lead existente."
      : "Você recebeu uma nova lead através das suas campanhas de Lead Ads na Meta (Facebook/Instagram).";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${isExisting ? "Novo Formulário - Meta" : "Nova Lead da Meta"}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1877F2;">${title}</h2>
            <p>Olá ${profile.full_name || ""},</p>
            <p>${description}</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Informações da Lead:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Nome:</strong> ${lead.name}</li>
                <li><strong>Email:</strong> ${leadFields.email || lead.email || "Não fornecido"}</li>
                <li><strong>Telefone:</strong> ${leadFields.phone_number || leadFields.phone || lead.phone || "Não fornecido"}</li>
              </ul>
              
              ${fieldsHtml ? `<h4>Campos do Formulário:</h4><ul>${fieldsHtml}</ul>` : ""}
            </div>
            
            <p>
              <a href="${appUrl}/leads" 
                 style="display: inline-block; padding: 12px 24px; background: #1877F2; color: white; text-decoration: none; border-radius: 5px;">
                Ver Lead no CRM
              </a>
            </p>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Este é um email automático do sistema Vyxa CRM.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email via nodemailer
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

    const info = await transporter.sendMail({
      from: smtpSettings.from_name
        ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
        : smtpSettings.from_email,
      to: profile.email,
      subject: isExisting
        ? `🔄 Formulário Meta: ${lead.name} - Vyxa CRM`
        : "🎯 Nova Lead da Meta - Vyxa CRM",
      html: emailHtml,
    });

    console.log(
      "✅ Notification email sent to:",
      profile.email,
      "MessageID:",
      info.messageId
    );
  } catch (error) {
    console.error("Error sending notification email:", error);
  }
}

function formatWorkflowAttachments(attachments: unknown) {
  if (!Array.isArray(attachments)) {
    return undefined;
  }

  const normalizedAttachments = attachments
    .filter((attachment) => attachment && typeof attachment === "object")
    .map((attachment: any) => {
      if (attachment.url || attachment.path) {
        return {
          filename: attachment.filename || attachment.name || "Anexo",
          path: attachment.url || attachment.path,
        };
      }
      return attachment;
    });

  return normalizedAttachments.length > 0 ? normalizedAttachments : undefined;
}