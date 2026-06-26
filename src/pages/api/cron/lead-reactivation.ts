import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";
import nodemailer from "nodemailer";
import crypto from "crypto";

/**
 * Cron Job: Lead Reactivation & Follow-up
 * 
 * Executa automaticamente a reativação de leads frias (sem contacto há 30+ dias)
 * com cadência de 3 tentativas (+0/+3/+7 dias):
 * 
 * - COM opt-in WhatsApp: Envia template "voltar_ao_radar"
 * - SEM opt-in WhatsApp: Envia email com link para landing de opt-in
 * 
 * Validações RGPD:
 * - Verifica consentimento antes de qualquer envio
 * - Respeita opt-out de email e WhatsApp
 * - Valida janela de 24h da Meta para mensagens livres
 * 
 * Configurado no vercel.json para executar diariamente às 9h UTC.
 */

interface LeadToProcess {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  follow_up_state?: string;
  updated_at: string;
  reactivation_attempts: number;
  location_preference?: string;
  buy_purpose?: string;
  consent_token?: string;
  email_opt_out?: boolean;
  email_unsub_token?: string;
  last_reactivation_sent_at?: string;
}

interface ProcessingResults {
  processed: number;
  whatsapp_sent: number;
  email_sent: number;
  archived: number;
  skipped: number;
  errors: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify this is an authorized cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Lead Reactivation] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Lead Reactivation] Starting daily reactivation at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: ProcessingResults = {
    processed: 0,
    whatsapp_sent: 0,
    email_sent: 0,
    archived: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Select leads that need reactivation (not archived, opt_out, or in active conversation)
    const { data: leadsToProcess, error } = await supabaseAdmin
      .from("leads")
      .select(`
        id, user_id, name, email, phone, follow_up_state, updated_at, 
        reactivation_attempts, location_preference, buy_purpose, 
        consent_token, email_opt_out, email_unsub_token, last_reactivation_sent_at
      `)
      .not("follow_up_state", "in", '("archived","opt_out","in_conversation")');

    if (error) {
      throw error;
    }

    console.log(`[Lead Reactivation] Found ${leadsToProcess?.length || 0} leads to evaluate`);

    // Process each lead individually with error tolerance
    for (const lead of leadsToProcess || []) {
      try {
        await processLead(lead as LeadToProcess, supabaseAdmin, results);
      } catch (leadError: any) {
        console.error(`[Lead Reactivation] Error processing lead ${lead.id}:`, {
          error: leadError.message,
          lead_id: lead.id,
        });
        results.errors++;
      }
      results.processed++;
    }

    console.log("[Lead Reactivation] Completed successfully:", results);

    return res.status(200).json({
      success: true,
      message: "Lead reactivation completed",
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Lead Reactivation] Fatal error:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      results,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Process a single lead for reactivation
 */
async function processLead(
  lead: LeadToProcess,
  supabaseAdmin: any,
  results: ProcessingResults
): Promise<void> {
  const attempts = lead.reactivation_attempts || 0;
  const now = new Date().getTime();
  const updatedAt = new Date(lead.updated_at).getTime();
  const daysSinceUpdate = (now - updatedAt) / (1000 * 3600 * 24);

  // Idempotency check: Don't send again if already sent today
  if (lead.last_reactivation_sent_at) {
    const lastSent = new Date(lead.last_reactivation_sent_at).getTime();
    const hoursSinceLastSent = (now - lastSent) / (1000 * 3600);
    if (hoursSinceLastSent < 23) {
      results.skipped++;
      return;
    }
  }

  let shouldSend = false;
  let nextAttempt = attempts;
  let shouldArchive = false;

  // Determine if we should send based on state and cadence
  if (lead.follow_up_state === "reengagement") {
    // In reengagement flow: +3 days for 2nd attempt, +4 more days for 3rd (total +7 from start)
    if (attempts === 1 && daysSinceUpdate >= 3) {
      shouldSend = true;
      nextAttempt = 2;
    } else if (attempts === 2 && daysSinceUpdate >= 4) {
      shouldSend = true;
      nextAttempt = 3;
    } else if (attempts >= 3 && daysSinceUpdate >= 7) {
      shouldArchive = true;
    }
  } else {
    // Cold lead: 30+ days without updates/interaction
    if (daysSinceUpdate >= 30) {
      shouldSend = true;
      nextAttempt = 1;
    }
  }

  // Archive after 3 failed attempts
  if (shouldArchive) {
    await supabaseAdmin.from("leads").update({
      follow_up_state: "archived",
      archive_reason: "Sem resposta após 3 tentativas de reativação"
    }).eq("id", lead.id);
    
    results.archived++;
    return;
  }

  if (!shouldSend) {
    results.skipped++;
    return;
  }

  // Try to reactivate via WhatsApp if has consent, otherwise via Email
  const hasWhatsAppOptIn = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);

  if (hasWhatsAppOptIn && lead.phone) {
    await sendWhatsAppReactivation(lead, nextAttempt, supabaseAdmin, results);
  } else if (lead.email && !lead.email_opt_out) {
    await sendEmailReactivation(lead, nextAttempt, supabaseAdmin, results);
  } else {
    // No way to reach lead or opted out of both channels
    await supabaseAdmin.from("leads").update({
      follow_up_state: "archived",
      archive_reason: lead.email_opt_out 
        ? "Opt-out de email, sem WhatsApp opt-in" 
        : "Sem contacto disponível para reativação"
    }).eq("id", lead.id);
    
    results.archived++;
  }
}

/**
 * Send WhatsApp reactivation template
 */
async function sendWhatsAppReactivation(
  lead: LeadToProcess,
  attemptNumber: number,
  supabaseAdmin: any,
  results: ProcessingResults
): Promise<void> {
  const result = await sendWhatsAppTemplate(
    lead.user_id, 
    lead.phone!, 
    "voltar_ao_radar", 
    supabaseAdmin, 
    lead.id
  );
  
  if (result.success) {
    await supabaseAdmin.from("leads").update({ 
      follow_up_state: "reengagement",
      reactivation_attempts: attemptNumber,
      last_reactivation_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", lead.id);
    
    await supabaseAdmin.from("interactions").insert({
      lead_id: lead.id,
      user_id: lead.user_id,
      interaction_type: "whatsapp_outbound",
      content: `Template de reativação WhatsApp enviado (Tentativa ${attemptNumber}/3)`,
      interaction_date: new Date().toISOString()
    });
    
    results.whatsapp_sent++;
    console.log(`[Lead Reactivation] WhatsApp sent to lead ${lead.id} (attempt ${attemptNumber}/3)`);
  } else {
    console.error(`[Lead Reactivation] Failed to send WhatsApp to lead ${lead.id}:`, result.error);
    throw new Error(result.error || "WhatsApp send failed");
  }
}

/**
 * Send Email reactivation with opt-in link
 */
async function sendEmailReactivation(
  lead: LeadToProcess,
  attemptNumber: number,
  supabaseAdmin: any,
  results: ProcessingResults
): Promise<void> {
  // Get SMTP settings for this user
  const { data: smtpSettings } = await supabaseAdmin
    .from("user_smtp_settings")
    .select("*")
    .eq("user_id", lead.user_id)
    .maybeSingle();

  if (!smtpSettings?.smtp_host) {
    console.log(`[Lead Reactivation] Lead ${lead.id} requires email but Agent ${lead.user_id} has no SMTP configured`);
    results.skipped++;
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpSettings.smtp_host,
    port: smtpSettings.smtp_port,
    secure: smtpSettings.smtp_secure,
    auth: {
      user: smtpSettings.smtp_username,
      pass: smtpSettings.smtp_password,
    },
    tls: { rejectUnauthorized: smtpSettings.reject_unauthorized ?? true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyxa.pt";
  
  // Generate consent token if needed
  let token = lead.consent_token;
  if (!token) {
    token = crypto.randomUUID();
    await supabaseAdmin.from("leads").update({ consent_token: token }).eq("id", lead.id);
  }

  // Generate email unsubscribe token if needed
  let emailUnsubToken = lead.email_unsub_token;
  if (!emailUnsubToken) {
    emailUnsubToken = crypto.randomUUID();
    await supabaseAdmin.from("leads").update({ email_unsub_token: emailUnsubToken }).eq("id", lead.id);
  }

  const optInUrl = `${appUrl}/optin/${token}`;
  const optOutUrl = `${appUrl}/unsubscribe/${emailUnsubToken}`;
  
  // Get agent profile for template variables
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

  // Select template based on attempt number
  const templateName = attemptNumber === 1 ? 'optin_inicial' : 
                       attemptNumber === 2 ? 'optin_lembrete_2' : 
                       'optin_lembrete_final';
  
  const { data: template } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", templateName)
    .maybeSingle();
  
  if (!template) {
    console.error(`[Lead Reactivation] Email template ${templateName} not found`);
    throw new Error(`Template ${templateName} not found`);
  }

  // Render template variables
  const html = template.html_body
    .replace(/\{\{nome\}\}/g, lead.name || 'Cliente')
    .replace(/\{\{procura\}\}/g, procuraStr)
    .replace(/\{\{consultor\}\}/g, consultor)
    .replace(/\{\{empresa\}\}/g, empresa)
    .replace(/\{\{link_optin\}\}/g, optInUrl)
    .replace(/\{\{link_unsubscribe\}\}/g, optOutUrl);
    
  const subject = template.subject
    .replace(/\{\{nome\}\}/g, lead.name || 'Cliente')
    .replace(/\{\{procura\}\}/g, procuraStr);

  // Send email
  await transporter.sendMail({
    from: smtpSettings.from_name 
      ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>` 
      : smtpSettings.from_email,
    to: lead.email,
    subject: subject,
    html,
  });

  // Update lead state
  await supabaseAdmin.from("leads").update({ 
    follow_up_state: "reengagement",
    reactivation_attempts: attemptNumber,
    last_reactivation_sent_at: new Date().toISOString(),
    archive_reason: "A aguardar opt-in via email",
    updated_at: new Date().toISOString()
  }).eq("id", lead.id);

  // Log interaction
  await supabaseAdmin.from("interactions").insert({
    lead_id: lead.id,
    user_id: lead.user_id,
    interaction_type: "email",
    content: `Email de reativação enviado (${templateName} - Tentativa ${attemptNumber}/3)`,
    interaction_date: new Date().toISOString()
  });

  results.email_sent++;
  console.log(`[Lead Reactivation] Email sent to lead ${lead.id} (attempt ${attemptNumber}/3)`);
}