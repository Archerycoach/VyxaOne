import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { buildReactivationEmail } from "@/lib/server/reactivationEmail";
import { deriveAppUrl } from "@/lib/server/appUrl";

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

  const appUrl = deriveAppUrl(req);

  const results: ProcessingResults = {
    processed: 0,
    whatsapp_sent: 0,
    email_sent: 0,
    archived: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Autorização: só processa leads de consultores que ativaram
    // explicitamente esta automação em Definições. Por defeito está
    // desligada para todos — sem isto, nenhuma lead é processada.
    const { data: enabledProfiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("reactivation_automation_enabled", true);

    if (profilesError) {
      throw profilesError;
    }

    const enabledUserIds = new Set((enabledProfiles || []).map((p: { id: string }) => p.id));

    if (enabledUserIds.size === 0) {
      console.log("[Lead Reactivation] Nenhum utilizador tem esta automação ativada. A terminar.");
      return res.status(200).json({
        success: true,
        message: "Nenhum utilizador com a automação ativada",
        results,
        timestamp: new Date().toISOString(),
      });
    }

    // Select leads that need reactivation (not archived, opt_out, or in active conversation)
    const { data: leadsToProcessRaw, error } = await supabaseAdmin
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

    // Excluir leads em acompanhamento ativo (Radar) — estão a ser trabalhadas
    // e não devem entrar na reativação/auto-arquivo.
    const { data: radarRows } = await supabaseAdmin
      .from("radar_items")
      .select("entity_id")
      .eq("entity_type", "lead")
      .is("resolved_at", null);
    const radarLeadIds = new Set<string>((radarRows || []).map((r: { entity_id: string }) => r.entity_id));

    const leadsToProcess = (leadsToProcessRaw || []).filter(
      (lead: LeadToProcess) => enabledUserIds.has(lead.user_id) && !radarLeadIds.has(lead.id)
    );

    console.log(`[Lead Reactivation] Found ${leadsToProcess.length} leads to evaluate (de ${leadsToProcessRaw?.length || 0} candidatas, filtradas por autorização)`);

    // Process each lead individually with error tolerance
    for (const lead of leadsToProcess) {
      try {
        await processLead(lead as LeadToProcess, supabaseAdmin, results, appUrl);
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
  results: ProcessingResults,
  appUrl: string
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
    await sendEmailReactivation(lead, nextAttempt, supabaseAdmin, results, appUrl);
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
    lead.id,
    false,
    "lead_reactivation"
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
 * Send Email reactivation with opt-in link.
 * A renderização (escolha de template + variáveis + links opt-in/unsubscribe)
 * está centralizada em buildReactivationEmail, partilhada com a ferramenta de
 * teste de envios (/api/reactivation/test-send) para garantir que o teste é
 * idêntico ao envio real.
 */
async function sendEmailReactivation(
  lead: LeadToProcess,
  attemptNumber: number,
  supabaseAdmin: any,
  results: ProcessingResults,
  appUrl: string
): Promise<void> {
  // O template é escolhido pelo nº de emails de reativação JÁ enviados a esta
  // lead — e não pelo contador global `reactivation_attempts`, que é
  // partilhado com o WhatsApp. Sem isto, uma lead que mude de canal a meio da
  // cadência (ex.: 2 tentativas por WhatsApp e depois perde o opt-in), ou cujo
  // contador tenha ficado "à frente" por estado antigo na BD, receberia o
  // lembrete final como PRIMEIRO email. Contamos no automated_email_log
  // (fonte única dos envios automáticos), excluindo envios de teste.
  let emailAttempt = attemptNumber;
  const { count, error: countError } = await supabaseAdmin
    .from("automated_email_log")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id)
    .eq("source", "lead_reactivation")
    .eq("status", "sent")
    .not("subject", "ilike", "[TESTE]%");

  if (!countError && typeof count === "number") {
    emailAttempt = Math.min(count + 1, 3);
  }

  const built = await buildReactivationEmail({ supabaseAdmin, lead, attemptNumber: emailAttempt, appUrl });

  if (!built) {
    console.error(`[Lead Reactivation] Email template para tentativa ${emailAttempt} não encontrado`);
    throw new Error(`Template de reativação (tentativa ${emailAttempt}) não encontrado`);
  }

  const { subject, html, templateName } = built;

  const sendResult = await sendClientEmail({
    supabaseAdmin,
    userId: lead.user_id,
    leadId: lead.id,
    leadName: lead.name,
    source: "lead_reactivation",
    to: lead.email!,
    subject,
    html,
  });

  if (!sendResult.success) {
    console.error(`[Lead Reactivation] Falha ao enviar email para lead ${lead.id}:`, sendResult.error);
    results.skipped++;
    return;
  }

  // Update lead state. Grava emailAttempt (e não attemptNumber) para que,
  // quando a cadência recomeça no email 1, os runs seguintes continuem 2 → 3
  // → arquivo, em vez de arquivarem logo a seguir ao primeiro email.
  await supabaseAdmin.from("leads").update({
    follow_up_state: "reengagement",
    reactivation_attempts: emailAttempt,
    last_reactivation_sent_at: new Date().toISOString(),
    archive_reason: "A aguardar opt-in via email",
    updated_at: new Date().toISOString()
  }).eq("id", lead.id);

  // Log interaction — regista o assunto e o texto reais que foram enviados
  // (não só uma nota de estado interna), para aparecer correto na Caixa de
  // Entrada. Não atualiza last_contact_date: um email de reativação
  // automático não conta como um contacto genuíno, tal como já acontecia
  // antes desta correção.
  await logEmailInteractionServer(supabaseAdmin, {
    leadId: lead.id,
    userId: lead.user_id,
    to: lead.email!,
    subject,
    body: html,
    outcome: `Email de reativação enviado (${templateName} - Tentativa ${emailAttempt}/3)`,
    updateLastContact: false,
  });

  results.email_sent++;
  console.log(`[Lead Reactivation] Email sent to lead ${lead.id} (attempt ${emailAttempt}/3)`);
}