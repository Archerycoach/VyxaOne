import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/services/whatsappService";
import { getGoogleCalendarFreeBusy, syncEventToGoogle } from "@/lib/googleCalendar";
import { recordOptOut } from "@/services/consentService";
import { calculateLeadScore } from "@/services/leadScoringService";

// Initialize Supabase Admin client to bypass RLS for webhook processing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Find next available 30-minute slot based on Google Calendar free/busy
 */
async function findNextAvailableSlot(userId: string): Promise<{ start: Date; end: Date } | null> {
  try {
    const { data: integration } = await supabaseAdmin
      .from("google_calendar_integrations" as any)
      .select("calendar_id, access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration) return null;
    
    const integrationData = integration as any;
    const accessToken = integrationData.access_token;
    if (!accessToken) return null;

    const calendarId = integrationData.calendar_id || "primary";
    
    // Look ahead 7 days
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7);

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const busySlots = data.calendars?.[calendarId]?.busy || [];
    
    // Find first available slot (preferably between 9 AM and 6 PM)
    const now = new Date();
    const candidateStart = new Date(now);
    
    // Round to next hour
    candidateStart.setMinutes(0, 0, 0);
    candidateStart.setHours(candidateStart.getHours() + 1);
    
    // If it's past 6 PM, start from 9 AM next day
    if (candidateStart.getHours() >= 18) {
      candidateStart.setDate(candidateStart.getDate() + 1);
      candidateStart.setHours(9, 0, 0, 0);
    } else if (candidateStart.getHours() < 9) {
      candidateStart.setHours(9, 0, 0, 0);
    }

    // Try to find a slot within next 7 days
    for (let day = 0; day < 7; day++) {
      for (let hour = 9; hour < 18; hour++) {
        const slotStart = new Date(candidateStart);
        slotStart.setDate(candidateStart.getDate() + day);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(30);
        
        // Check if this slot overlaps with any busy period
        const hasConflict = busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (slotStart < busyEnd && slotEnd > busyStart);
        });
        
        if (!hasConflict) {
          return { start: slotStart, end: slotEnd };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("[findNextAvailableSlot] Error:", error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Webhook verification from Meta
  if (req.method === "GET") {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase credentials for WhatsApp Webhook");
        return res.status(500).send("Server configuration error");
      }

      // Retrieve global verify token
      const { data: adminSettings, error } = await supabaseAdmin
        .from("integration_settings")
        .select("settings")
        .eq("integration_name", "whatsapp_api")
        .maybeSingle();

      if (error) {
        console.error("Error fetching global WhatsApp settings during webhook verification:", error);
        return res.status(500).send("Database error");
      }

      const globalVerifyToken = adminSettings?.settings ? (adminSettings.settings as any).verify_token : undefined;

      if (mode === "subscribe" && token === globalVerifyToken) {
        console.log("WhatsApp Webhook verified with Global API token");
        return res.status(200).send(challenge);
      }
      
      console.error(`Webhook verification failed. Provided token: ${token}, Expected: ${globalVerifyToken}`);
      return res.status(403).send("Forbidden");
    } catch (error) {
      console.error("Unexpected error during WhatsApp Webhook GET verification:", error);
      return res.status(500).send("Internal Server Error");
    }
  }

  // Handle incoming messages
  if (req.method === "POST") {
    try {
      const body = req.body;

      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          const incomingPhoneNumberId = entry.changes[0]?.value?.metadata?.phone_number_id;
          
          if (!incomingPhoneNumberId) continue;

          // Process the incoming messages
          if (entry.changes[0]?.value?.messages) {
            for (const message of entry.changes[0].value.messages) {
              const from = message.from;
              const text = message.text?.body;
              
              if (!text) continue;
              
              console.log(`Received WA message from ${from}: ${text.substring(0, 50)}...`);

              // 1. Identify which Lead this number belongs to (Global Search)
              const phoneSuffix = from.length > 9 ? from.substring(from.length - 9) : from;
              
              const { data: leads } = await supabaseAdmin
                .from("leads")
                .select("id, name, temperature, status, user_id, follow_up_state, assigned_to")
                .ilike("phone", `%${phoneSuffix}%`)
                .order("created_at", { ascending: false })
                .limit(1);

              const lead = leads?.[0];

              if (!lead) {
                console.log(`No lead found for phone ${from}`);
                continue;
              }

              // 2. Check if the consultant who owns this lead has WhatsApp active
              const { data: userProfile } = await supabaseAdmin
                .from("profiles")
                .select("whatsapp_module_enabled")
                .eq("id", lead.user_id)
                .maybeSingle();

              if (!userProfile?.whatsapp_module_enabled) {
                console.log(`User ${lead.user_id} has WA module disabled. Ignoring message from lead.`);
                continue;
              }

              // 3. Handle Opt-outs (GDPR / Meta Compliance)
              const cleanText = text.trim().toLowerCase();
              const optOutKeywords = ["stop", "cancelar", "sair", "parar", "remover"];
              
              if (optOutKeywords.includes(cleanText)) {
                console.log(`[WhatsApp Webhook] Opt-out requested by lead ${lead.id}`);
                await recordOptOut(lead.id, lead.user_id, supabaseAdmin);
                
                await supabaseAdmin.from("leads").update({ 
                  follow_up_state: "opt_out", 
                  archive_reason: "Opt-out recebido via WhatsApp",
                  reactivation_attempts: 0
                }).eq("id", lead.id);

                await supabaseAdmin.from("interactions").insert({
                  lead_id: lead.id,
                  user_id: lead.user_id,
                  interaction_type: "whatsapp_inbound",
                  content: `Recebido (Opt-out): ${text}`,
                  interaction_date: new Date().toISOString()
                });
                
                // Confirm opt-out (Note: omitting leadId to bypass our own send check, so we can send the final confirmation)
                await sendWhatsAppMessage(lead.user_id, from, "O seu contacto foi removido da nossa lista. Não receberá mais mensagens.", supabaseAdmin);
                continue; // Stop further processing (no AI reply)
              }

              // 3.5. Handle Calendar Event Confirmations/Rescheduling
              const confirmKeywords = ["confirmar", "confirmo", "confirmado", "sim", "ok", "está bem"];
              const rescheduleKeywords = ["reagendar", "outro horário", "outra hora", "mudar", "alterar"];
              
              const isConfirmation = confirmKeywords.some(keyword => cleanText.includes(keyword));
              const isReschedule = rescheduleKeywords.some(keyword => cleanText.includes(keyword));
              
              if (isConfirmation || isReschedule) {
                // Check if there's a pending calendar event for this lead
                const { data: pendingEvent } = await supabaseAdmin
                  .from("calendar_events")
                  .select("id, start_time, title")
                  .eq("lead_id", lead.id)
                  .eq("requires_confirmation", true)
                  .is("confirmed_at", null)
                  .is("no_show_at", null)
                  .gte("start_time", new Date().toISOString())
                  .order("start_time", { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (pendingEvent) {
                  if (isConfirmation) {
                    // Mark event as confirmed
                    await supabaseAdmin
                      .from("calendar_events")
                      .update({ confirmed_at: new Date().toISOString() })
                      .eq("id", pendingEvent.id);

                    await supabaseAdmin.from("interactions").insert({
                      lead_id: lead.id,
                      user_id: lead.user_id,
                      interaction_type: "whatsapp_inbound",
                      content: `Confirmou agendamento: ${pendingEvent.title}`,
                      interaction_date: new Date().toISOString()
                    });

                    const confirmedTime = new Date(pendingEvent.start_time).toLocaleString('pt-PT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    await sendWhatsAppMessage(
                      lead.user_id, 
                      from, 
                      `Perfeito! A nossa chamada está confirmada para ${confirmedTime}. Até breve! 👍`, 
                      supabaseAdmin, 
                      lead.id
                    );

                    // Notify agent
                    const assignedTo = lead.assigned_to || lead.user_id;
                    await supabaseAdmin.from("notifications").insert({
                      user_id: assignedTo,
                      type: "info",
                      priority: "medium",
                      title: `✅ ${lead.name} confirmou agendamento`,
                      message: `Agendamento confirmado para ${confirmedTime}`
                    });

                    console.log(`[WhatsApp Webhook] Lead ${lead.id} confirmed event ${pendingEvent.id}`);
                    continue; // Don't send to AI
                  } else if (isReschedule) {
                    // Find new slot and propose
                    const newSlot = await findNextAvailableSlot(lead.user_id);
                    
                    if (newSlot) {
                      const newStartTime = newSlot.start.toISOString();
                      const newEndTime = newSlot.end.toISOString();
                      
                      // Update existing event with new time
                      await supabaseAdmin
                        .from("calendar_events")
                        .update({
                          start_time: newStartTime,
                          end_time: newEndTime,
                          reminder_sent_24h: false,
                          reminder_sent_2h: false
                        })
                        .eq("id", pendingEvent.id);

                      // Sync to Google Calendar
                      await syncEventToGoogle({
                        title: pendingEvent.title,
                        description: `Reagendado via WhatsApp`,
                        start_time: newStartTime,
                        end_time: newEndTime,
                      }, null, lead.user_id);

                      await supabaseAdmin.from("interactions").insert({
                        lead_id: lead.id,
                        user_id: lead.user_id,
                        interaction_type: "whatsapp_inbound",
                        content: `Pediu para reagendar: ${pendingEvent.title}`,
                        interaction_date: new Date().toISOString()
                      });

                      const newProposedTime = new Date(newStartTime).toLocaleString('pt-PT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      await sendWhatsAppMessage(
                        lead.user_id,
                        from,
                        `Sem problema! Posso reagendar para ${newProposedTime}. Confirma se este horário te serve?`,
                        supabaseAdmin,
                        lead.id
                      );

                      console.log(`[WhatsApp Webhook] Lead ${lead.id} requested reschedule, proposed: ${newProposedTime}`);
                      continue; // Don't send to AI
                    } else {
                      await sendWhatsAppMessage(
                        lead.user_id,
                        from,
                        `Neste momento não tenho disponibilidade imediata. Vou pedir ao consultor para entrar em contacto consigo para encontrarmos um horário que funcione para ambos.`,
                        supabaseAdmin,
                        lead.id
                      );

                      // Create manual task
                      const assignedTo = lead.assigned_to || lead.user_id;
                      await supabaseAdmin.from("tasks").insert({
                        title: `Reagendar com ${lead.name}`,
                        description: `A lead pediu para reagendar mas não há slots automáticos disponíveis. Contactar manualmente.`,
                        priority: "high",
                        status: "pending",
                        assigned_to: assignedTo,
                        lead_id: lead.id,
                        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                      });

                      continue;
                    }
                  }
                }
              }

              // 4. Add message to Interaction history (opens 24h window)
              await supabaseAdmin.from("interactions").insert({
                lead_id: lead.id,
                user_id: lead.user_id,
                interaction_type: "whatsapp_inbound",
                content: `Recebido: ${text}`,
                interaction_date: new Date().toISOString()
              });

              // ✅ Recalculate lead score after inbound message
              await calculateLeadScore(lead.id, supabaseAdmin, "whatsapp_inbound");

              // 5. Trigger the GPT agent to respond and qualify (Using Claude)
              const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
              
              if (anthropicApiKey) {
                try {
                  // Get recent interactions for context
                  const { data: recentInteractions } = await supabaseAdmin
                    .from("interactions")
                    .select("content, interaction_type")
                    .eq("lead_id", lead.id)
                    .order("interaction_date", { ascending: false })
                    .limit(5);

                  const historyText = recentInteractions 
                    ? recentInteractions.reverse().map(i => `${i.interaction_type === 'whatsapp_inbound' ? 'Lead' : 'Agente'}: ${i.content}`).join('\n')
                    : 'Sem histórico anterior.';

                  // Fetch agent's calendar availability
                  const availability = await getGoogleCalendarFreeBusy(lead.user_id);
                  
                  // Check if automation is paused for this agent
                  const { data: userProfile } = await supabaseAdmin
                    .from("profiles")
                    .select("whatsapp_module_enabled, automation_paused")
                    .eq("id", lead.user_id)
                    .maybeSingle();
                  
                  const automationPaused = userProfile?.automation_paused || false;

                  const systemPrompt = `És o assistente virtual imobiliário do consultor. Estás a falar no WhatsApp com a lead chamada ${lead.name}.
A temperatura atual desta lead é: ${lead.temperature || 'desconhecida'}.

INFORMAÇÃO DA AGENDA DO CONSULTOR:
${availability}

O teu objetivo é:
1. Responder à lead de forma natural, curta e conversacional (estilo WhatsApp).
2. Avaliar e sugerir o estado da conversa e a temperatura da lead (Quente/Morna/Fria).
3. Se a lead disser que NÃO tem interesse em continuar a procurar imóveis ou quiser cancelar, devolve "follow_up_state": "archived" e "archive_reason": "Sem interesse (via IA)".
4. Se qualificares a lead como Quente (hot) E ela demonstrar disponibilidade para falar, marca "wants_meeting": true para agendar automaticamente.
5. Extrai informação útil (orçamento, quartos, etc) para o objeto "lead_updates".
6. Se esta for a primeira resposta da lead a uma campanha Meta (follow_up_state = first_contact), podes incluir "send_documents": true no JSON para enviar documentos relevantes.
7. Responde APENAS em JSON VÁLIDO. Não incluas markdown \`\`\`json ou outro texto antes ou depois.

Formato OBRIGATÓRIO do JSON:
{
  "reply": "A tua resposta curta para o WhatsApp",
  "suggested_temperature": "hot" | "warm" | "cold" | "unchanged",
  "follow_up_state": "in_conversation" | "qualified" | "archived",
  "archive_reason": "Preencher apenas se archived",
  "wants_meeting": true,
  "send_documents": true,
  "lead_updates": {
    "budget_min": 100000,
    "budget_max": 200000,
    "property_type": "apartamento",
    "location_preference": "Lisboa",
    "bedrooms": 2
  }
}`;

                  const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": anthropicApiKey,
                      "anthropic-version": "2023-06-01"
                    },
                    body: JSON.stringify({
                      model: "claude-3-haiku-20240307",
                      max_tokens: 1024,
                      system: systemPrompt,
                      messages: [
                        { role: "user", content: `Histórico recente:\n${historyText}\n\nNova mensagem da lead: ${text}\n\nGera APENAS o JSON de resposta.` }
                      ],
                      temperature: 0.7,
                    })
                  });

                  if (response.ok) {
                    const aiData = await response.json();
                    let rawContent = aiData.content[0].text;
                    
                    // Cleanup possible markdown formatting from Claude
                    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
                    const result = JSON.parse(rawContent);
                    
                    if (result.reply && !automationPaused) {
                      // Send the reply back to the lead
                      await sendWhatsAppMessage(lead.user_id, from, result.reply, supabaseAdmin, lead.id);
                      
                      // Save outbound interaction
                      await supabaseAdmin.from("interactions").insert({
                        lead_id: lead.id,
                        user_id: lead.user_id,
                        interaction_type: "whatsapp_outbound",
                        content: `Enviado (IA): ${result.reply}`,
                        interaction_date: new Date().toISOString()
                      });
                    }

                    // Send documents if Claude suggested and we're within 24h window
                    if (result.send_documents && !automationPaused) {
                      const { data: leadDetails } = await supabaseAdmin
                        .from("leads")
                        .select("meta_form_id")
                        .eq("id", lead.id)
                        .single();

                      if (leadDetails?.meta_form_id) {
                        // Find documents associated with this Meta form via tags or custom fields
                        const { data: documents } = await supabaseAdmin
                          .from("documents")
                          .select("name, file_path")
                          .eq("user_id", lead.user_id)
                          .or(`tags.cs.{meta_form_${leadDetails.meta_form_id}},tags.cs.{campanha},tags.cs.{brochura}`)
                          .limit(5);

                        if (documents && documents.length > 0) {
                          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt";
                          const docLinks = documents.map(doc => `📄 ${doc.name}: ${appUrl}${doc.file_path}`).join('\n\n');
                          const docMessage = `Aqui estão os documentos que mencionei:\n\n${docLinks}`;
                          
                          await sendWhatsAppMessage(lead.user_id, from, docMessage, supabaseAdmin, lead.id);
                          
                          await supabaseAdmin.from("interactions").insert({
                            lead_id: lead.id,
                            user_id: lead.user_id,
                            interaction_type: "whatsapp_outbound",
                            content: `Enviado (IA - Documentos): ${documents.length} documento(s)`,
                            interaction_date: new Date().toISOString()
                          });
                          
                          console.log(`[WhatsApp Webhook] Sent ${documents.length} document(s) to lead ${lead.id}`);
                        }
                      }
                    }

                    // Auto-schedule meeting if Claude detected strong interest and wants_meeting is true
                    if (result.wants_meeting && !automationPaused) {
                      console.log(`[WhatsApp Webhook] AI detected lead ${lead.id} wants a meeting, finding slot...`);
                      
                      const nextSlot = await findNextAvailableSlot(lead.user_id);
                      
                      if (nextSlot) {
                        const startTime = nextSlot.start.toISOString();
                        const endTime = nextSlot.end.toISOString();
                        
                        // Create calendar event
                        const googleEventId = await syncEventToGoogle({
                          title: `Chamada com ${lead.name}`,
                          description: `Agendado automaticamente pelo Agente IA via WhatsApp.\nTelefone: ${from}\nTemperatura: ${result.suggested_temperature || lead.temperature}`,
                          start_time: startTime,
                          end_time: endTime,
                        }, null, lead.user_id);

                        // Register interaction
                        await supabaseAdmin.from("interactions").insert({
                          lead_id: lead.id,
                          user_id: lead.user_id,
                          interaction_type: "call",
                          content: `Chamada agendada automaticamente via WhatsApp para ${new Date(startTime).toLocaleString('pt-PT')}`,
                          interaction_date: new Date().toISOString()
                        });
                        
                        // Propose the time to the lead
                        const proposedTime = new Date(startTime).toLocaleString('pt-PT', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        
                        const proposalMessage = `Perfeito! Tenho disponibilidade para falarmos ${proposedTime}. Confirma se te dá jeito este horário ou se preferes outro dia/hora?`;
                        
                        await sendWhatsAppMessage(lead.user_id, from, proposalMessage, supabaseAdmin, lead.id);
                        
                        await supabaseAdmin.from("interactions").insert({
                          lead_id: lead.id,
                          user_id: lead.user_id,
                          interaction_type: "whatsapp_outbound",
                          content: `Enviado (IA - Proposta Agendamento): ${proposalMessage}`,
                          interaction_date: new Date().toISOString()
                        });
                        
                        console.log(`[WhatsApp Webhook] Proposed meeting time: ${proposedTime}`);
                      } else {
                        // No Google Calendar integration or no slots found - just create task
                        console.log(`[WhatsApp Webhook] No Google Calendar integration or slots found, creating task only`);
                      }
                    }

                    // Update lead temperature and state
                    const updates: any = {};
                    
                    if (result.suggested_temperature && result.suggested_temperature !== "unchanged") {
                      updates.temperature = result.suggested_temperature;
                      
                      // Create URGENT Task & Notification if became HOT
                      if (result.suggested_temperature === "hot" && lead.temperature !== "hot") {
                        // Get assigned_to (or default to user_id if not assigned)
                        const assignedTo = lead.assigned_to || lead.user_id;
                        
                        // Build qualification summary from lead_updates
                        let qualificationSummary = "Demonstrou forte interesse no WhatsApp.";
                        if (result.lead_updates) {
                          const details = [];
                          if (result.lead_updates.budget_min || result.lead_updates.budget_max) {
                            details.push(`Orçamento: ${result.lead_updates.budget_min || '?'} - ${result.lead_updates.budget_max || '?'}€`);
                          }
                          if (result.lead_updates.property_type) {
                            details.push(`Tipo: ${result.lead_updates.property_type}`);
                          }
                          if (result.lead_updates.location_preference) {
                            details.push(`Localização: ${result.lead_updates.location_preference}`);
                          }
                          if (result.lead_updates.bedrooms) {
                            details.push(`Quartos: ${result.lead_updates.bedrooms}`);
                          }
                          if (details.length > 0) {
                            qualificationSummary += "\n" + details.join("\n");
                          }
                        }
                        
                        // Find if we scheduled a meeting
                        const { data: scheduledEvent } = await supabaseAdmin
                          .from("interactions")
                          .select("content")
                          .eq("lead_id", lead.id)
                          .eq("interaction_type", "call")
                          .order("interaction_date", { ascending: false })
                          .limit(1)
                          .maybeSingle();
                        
                        const meetingInfo = scheduledEvent ? `\n\n${scheduledEvent.content}` : "";
                        
                        await supabaseAdmin.from("tasks").insert({
                          title: `🔥 Ligar a ${lead.name}`,
                          description: `Lead QUENTE detectada pela IA no WhatsApp!\n\nTelefone: ${from}\n\n${qualificationSummary}${meetingInfo}`,
                          priority: "urgent",
                          status: "pending",
                          assigned_to: assignedTo,
                          lead_id: lead.id,
                          due_date: new Date().toISOString()
                        });

                        await supabaseAdmin.from("notifications").insert({
                          user_id: assignedTo,
                          type: "lead_match",
                          priority: "urgent",
                          title: "🔥 Lead Quente no WhatsApp!",
                          message: `${lead.name} demonstrou forte interesse.\n\nTelefone: ${from}\n\n${qualificationSummary}${meetingInfo}`
                        });
                        
                        console.log(`[WhatsApp Webhook] Created urgent task and notification for hot lead ${lead.id}`);
                      }
                    }
                    
                    if (result.follow_up_state) {
                      updates.follow_up_state = result.follow_up_state;
                      if (result.archive_reason) {
                        updates.archive_reason = result.archive_reason;
                      }
                    } else if (lead.follow_up_state === 'new' || lead.follow_up_state === 'first_contact' || lead.follow_up_state === 'reengagement') {
                      updates.follow_up_state = 'in_conversation';
                    }
                    
                    // Reset attempts as we got a response
                    updates.reactivation_attempts = 0;
                    
                    // Apply AI extracted lead updates
                    if (result.lead_updates) {
                      for (const [key, value] of Object.entries(result.lead_updates)) {
                        if (value !== null && value !== undefined) {
                          updates[key] = value;
                        }
                      }
                    }

                    if (Object.keys(updates).length > 0) {
                      await supabaseAdmin
                        .from("leads")
                        .update(updates)
                        .eq("id", lead.id);
                        
                      console.log(`[WhatsApp Webhook] Lead ${lead.id} updated with AI data:`, updates);
                      
                      if (result.lead_updates && Object.keys(result.lead_updates).length > 0) {
                        await supabaseAdmin.from("interactions").insert({
                          lead_id: lead.id,
                          user_id: lead.user_id,
                          interaction_type: "note",
                          content: `Dados atualizados automaticamente pelo Claude (via WhatsApp):\n${JSON.stringify(result.lead_updates, null, 2)}`,
                          interaction_date: new Date().toISOString()
                        });
                      }
                      
                      // Recalculate lead score
                      await calculateLeadScore(lead.id, supabaseAdmin);
                    }
                  } else {
                    const errorText = await response.text();
                    console.error("Anthropic API Error:", errorText);
                  }
                } catch (aiError) {
                  console.error("Error generating Anthropic reply:", aiError);
                }
              }
              
              // We return 200 OK immediately so Meta doesn't retry
            }
          }
        }
        res.status(200).send("EVENT_RECEIVED");
        return;
      }
      
      res.status(404).send("NOT_FOUND");
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).send("INTERNAL_SERVER_ERROR");
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
}