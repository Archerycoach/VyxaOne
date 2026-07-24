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
  reactivation_emails_sent?: number;
  reactivation_angles_used?: string[];
  reactivation_started_at?: string | null;
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
        id, user_id, name, email, phone, follow_up_state, updated_at, last_contact_date, created_at,
        reactivation_attempts, location_preference, buy_purpose, 
        consent_token, email_opt_out, email_unsub_token, last_reactivation_sent_at,
        reactivation_emails_sent, reactivation_angles_used, reactivation_started_at
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

    // Teto de envios por execução.
    //
    // A correção do relógio (last_contact_date em vez de updated_at) tornou
    // elegíveis, de uma vez, centenas de leads acumuladas. Sem teto, a
    // primeira execução despejava-as todas num dia — mau para a reputação do
    // SMTP e para o remetente. Com 60/dia, um atraso de ~760 leads escoa em
    // duas semanas, e o ritmo diário fica sempre dentro do razoável.
    const MAX_SENDS_PER_RUN = 60;

    // Process each lead individually with error tolerance
    for (const lead of leadsToProcess) {
      if (results.email_sent + results.whatsapp_sent >= MAX_SENDS_PER_RUN) {
        results.skipped++;
        continue;
      }
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
/**
 * Cadência da sequência de reativação, em dias desde o início.
 *
 * 6 emails ao longo de ~6 meses. Substitui os 3 emails em 7 dias, que era
 * pouco tempo para quem está a decidir comprar casa — um processo de meses.
 *
 * Espaçar em vez de insistir também protege a reputação do domínio: a partir
 * de ~7 emails sem abertura, o Gmail e o Outlook penalizam TODO o correio do
 * remetente, incluindo o dirigido a clientes ativos.
 */
// Cadência da sequência: densa no início, e nunca mais de 30 dias entre
// emails — entre os 45 e os 180 havia intervalos de 45-90 dias em que a lead
// simplesmente não ouvia falar de nós.
const REACTIVATION_CADENCE_DAYS = [0, 7, 21, 45, 75, 105, 135, 165];

// Concluída a sequência sem resposta, recomeça do início após esta pausa —
// até a lead responder ou pedir para parar (opt-out). O consultor é avisado
// em cada ciclo concluído (via Radar/notificação), mas a máquina não desiste
// sozinha.
const RESTART_PAUSE_DAYS = 30;

async function processLead(
  lead: LeadToProcess,
  supabaseAdmin: any,
  results: ProcessingResults,
  appUrl: string
): Promise<void> {
  const attempts = lead.reactivation_attempts || 0;
  const now = new Date().getTime();

  // "Lead fria" mede-se pelo último CONTACTO, não pelo updated_at: qualquer
  // correção administrativa (associar empreendimento, acertar um orçamento,
  // um retro-preenchimento) toca no updated_at e reiniciava o relógio dos
  // 30 dias da base inteira — foi assim que a reativação ficou semanas sem
  // enviar um único email.
  const referenceDate =
    (lead as any).last_contact_date || (lead as any).created_at || lead.updated_at;
  const updatedAt = new Date(referenceDate).getTime();
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

  // Nº de emails de reativação JÁ enviados — contador próprio da sequência,
  // não partilhado com o WhatsApp nem dependente de outra tabela.
  const emailsSent = (lead as any).reactivation_emails_sent || 0;

  // Dias desde o INÍCIO da sequência (não desde a última atualização): é o
  // que define em que ponto da cadência a lead está.
  const startedAt = (lead as any).reactivation_started_at;
  const daysSinceStart = startedAt
    ? (now - new Date(startedAt).getTime()) / (1000 * 3600 * 24)
    : 0;

  let shouldRestartCycle = false;

  if (lead.follow_up_state === "reengagement") {
    if (emailsSent >= REACTIVATION_CADENCE_DAYS.length) {
      // Sequência concluída sem resposta: recomeça após a pausa, com os
      // ângulos limpos para os textos não repetirem os do ciclo anterior.
      // Só o opt-out (ou uma resposta) trava o ciclo — decisão explícita:
      // "recomeça até responder ou pedir para parar".
      const lastSentAt = lead.last_reactivation_sent_at
        ? new Date(lead.last_reactivation_sent_at).getTime()
        : 0;
      const daysSinceLastEmail = lastSentAt ? (now - lastSentAt) / (1000 * 3600 * 24) : Infinity;

      if (daysSinceLastEmail >= RESTART_PAUSE_DAYS) {
        shouldRestartCycle = true;
        shouldSend = true;
        nextAttempt = 1;
      }
    } else {
      // Próximo email quando o intervalo previsto já passou.
      const dueAfterDays = REACTIVATION_CADENCE_DAYS[emailsSent];
      if (daysSinceStart >= dueAfterDays) {
        shouldSend = true;
        nextAttempt = emailsSent + 1;
      }
    }
  } else {
    // Lead fria: 30+ dias sem atividade inicia a sequência.
    if (daysSinceUpdate >= 30) {
      shouldSend = true;
      nextAttempt = 1;
    }
  }

  // Reinício de ciclo: limpa os contadores ANTES do envio, para o email que
  // segue já ser o 1.º do novo ciclo (ângulos e contagem a zero).
  if (shouldRestartCycle) {
    await supabaseAdmin.from("leads").update({
      reactivation_emails_sent: 0,
      reactivation_angles_used: [],
      reactivation_started_at: new Date().toISOString(),
    }).eq("id", lead.id);
    (lead as any).reactivation_emails_sent = 0;
    (lead as any).reactivation_angles_used = [];

    // O consultor fica a saber que um ciclo inteiro terminou sem resposta —
    // é o momento certo para tentar outro canal (chamada, WhatsApp) em vez
    // de confiar só no próximo ciclo de emails.
    await supabaseAdmin.from("notifications").insert({
      user_id: lead.user_id,
      title: "🔁 Ciclo de reativação concluído sem resposta",
      message: `${lead.name}: ${REACTIVATION_CADENCE_DAYS.length} emails enviados sem resposta. A sequência recomeça hoje — considera tentar por outro canal.`,
      data: { kind: "reactivation_cycle", lead_id: lead.id, action_url: "/leads" },
    });
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
  // O email a enviar é decidido pelo contador PRÓPRIO da sequência
  // (leads.reactivation_emails_sent), não por contagens noutras tabelas nem
  // pelo reactivation_attempts, que é partilhado com o WhatsApp. Era daí que
  // vinha o "última mensagem" a chegar como primeiro email.
  const emailsAlreadySent = lead.reactivation_emails_sent || 0;
  const emailAttempt = emailsAlreadySent + 1;
  const isLastEmail = emailAttempt >= REACTIVATION_CADENCE_DAYS.length;
  const anglesUsed = lead.reactivation_angles_used || [];

  // Link de marcação do consultor, para o CTA do email.
  let bookingUrl: string | null = null;
  const { data: bookingProfile } = await supabaseAdmin
    .from("profiles")
    .select("booking_token")
    .eq("id", lead.user_id)
    .maybeSingle();
  if (bookingProfile?.booking_token) {
    bookingUrl = `${appUrl}/agendar/${bookingProfile.booking_token}`;
  }

  const built = await buildReactivationEmail({
    supabaseAdmin,
    lead,
    attemptNumber: emailAttempt,
    appUrl,
    bookingUrl,
    anglesUsed,
    isLastEmail,
  });

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
    // A assinatura já vem embutida no html (ordem: texto → assinatura →
    // "deixar de receber"); não a voltar a acrescentar aqui.
    appendSignatureToHtml: false,
  });

  if (!sendResult.success) {
    console.error(`[Lead Reactivation] Falha ao enviar email para lead ${lead.id}:`, sendResult.error);
    results.skipped++;
    return;
  }

  // Update lead state. Grava emailAttempt (e não attemptNumber) para que,
  // quando a cadência recomeça no email 1, os runs seguintes continuem 2 → 3
  // → arquivo, em vez de arquivarem logo a seguir ao primeiro email.
  const sentAt = new Date();
  const usedAngle = built.templateName.replace(/^ia:/, "");

  // Próxima data prevista, segundo a cadência longa.
  const startedAt = lead.reactivation_started_at
    ? new Date(lead.reactivation_started_at)
    : sentAt;
  const nextIndex = emailAttempt; // o índice seguinte da cadência
  const nextAt =
    nextIndex < REACTIVATION_CADENCE_DAYS.length
      ? new Date(startedAt.getTime() + REACTIVATION_CADENCE_DAYS[nextIndex] * 86400000)
      : null;

  await supabaseAdmin.from("leads").update({
    follow_up_state: "reengagement",
    reactivation_attempts: emailAttempt,
    // Contador próprio da sequência: a fonte de verdade de qual email vem a seguir.
    reactivation_emails_sent: emailAttempt,
    // Ângulo usado, para a IA não repetir a abordagem no próximo.
    reactivation_angles_used: [...anglesUsed, usedAngle],
    reactivation_started_at: lead.reactivation_started_at || sentAt.toISOString(),
    reactivation_next_at: nextAt ? nextAt.toISOString() : null,
    last_reactivation_sent_at: sentAt.toISOString(),
    archive_reason: "A aguardar opt-in via email",
    updated_at: sentAt.toISOString()
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