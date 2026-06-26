import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Cron Job: Calendar Reminders & Follow-up
 * 
 * Processes calendar events linked to leads:
 * - Send 24h reminder (if enabled)
 * - Send 2h reminder (if enabled)
 * - Mark no-show if not confirmed X hours before
 * - Re-offer slot to qualified leads who didn't respond within 24h
 * 
 * Schedule: Every hour (or as configured in vercel.json)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Calendar Reminders] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Calendar Reminders] Starting processing at", new Date().toISOString());

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    let reminders24h = 0;
    let reminders2h = 0;
    let noShows = 0;
    let reoffers = 0;
    let errors = 0;

    // ===== PART 1: Send 24h reminders =====
    const { data: events24h } = await supabaseAdmin
      .from("calendar_events")
      .select("id, user_id, title, start_time, lead_id, leads(id, name, phone, assigned_to)")
      .eq("requires_confirmation", true)
      .eq("reminder_sent_24h", false)
      .is("confirmed_at", null)
      .is("no_show_at", null)
      .gte("start_time", now.toISOString())
      .lte("start_time", in24h.toISOString());

    if (events24h && events24h.length > 0) {
      console.log(`[Calendar Reminders] Found ${events24h.length} events for 24h reminder`);
      
      for (const event of events24h) {
        try {
          const lead = (event as any).leads;
          if (!lead || !lead.phone) continue;

          // Check automation_paused
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("automation_paused")
            .eq("id", event.user_id)
            .maybeSingle();

          if (profile?.automation_paused) continue;

          // Check WhatsApp consent
          const hasConsent = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);
          if (!hasConsent) continue;

          // Send 24h reminder template
          const eventDate = new Date(event.start_time).toLocaleString('pt-PT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const result = await sendWhatsAppTemplate(
            event.user_id,
            lead.phone,
            "lembrete_24h", // Template must be approved in Meta Business Manager
            supabaseAdmin,
            lead.id
          );

          if (result.success) {
            await supabaseAdmin
              .from("calendar_events")
              .update({ reminder_sent_24h: true })
              .eq("id", event.id);

            await supabaseAdmin.from("interactions").insert({
              lead_id: lead.id,
              user_id: event.user_id,
              interaction_type: "whatsapp",
              content: `Lembrete 24h enviado: ${event.title} (${eventDate})`,
              interaction_date: now.toISOString()
            });

            reminders24h++;
            console.log(`[Calendar Reminders] ✅ 24h reminder sent to lead ${lead.id}`);
          }
        } catch (error) {
          console.error(`[Calendar Reminders] Error processing 24h reminder for event ${event.id}:`, error);
          errors++;
        }
      }
    }

    // ===== PART 2: Send 2h reminders =====
    const { data: events2h } = await supabaseAdmin
      .from("calendar_events")
      .select("id, user_id, title, start_time, lead_id, leads(id, name, phone, assigned_to)")
      .eq("requires_confirmation", true)
      .eq("reminder_sent_2h", false)
      .is("confirmed_at", null)
      .is("no_show_at", null)
      .gte("start_time", now.toISOString())
      .lte("start_time", in2h.toISOString());

    if (events2h && events2h.length > 0) {
      console.log(`[Calendar Reminders] Found ${events2h.length} events for 2h reminder`);
      
      for (const event of events2h) {
        try {
          const lead = (event as any).leads;
          if (!lead || !lead.phone) continue;

          // Check automation_paused
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("automation_paused")
            .eq("id", event.user_id)
            .maybeSingle();

          if (profile?.automation_paused) continue;

          // Check WhatsApp consent
          const hasConsent = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);
          if (!hasConsent) continue;

          // Send 2h reminder template
          const eventDate = new Date(event.start_time).toLocaleString('pt-PT', {
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit'
          });

          const result = await sendWhatsAppTemplate(
            event.user_id,
            lead.phone,
            "lembrete_2h", // Template must be approved in Meta Business Manager
            supabaseAdmin,
            lead.id
          );

          if (result.success) {
            await supabaseAdmin
              .from("calendar_events")
              .update({ reminder_sent_2h: true })
              .eq("id", event.id);

            await supabaseAdmin.from("interactions").insert({
              lead_id: lead.id,
              user_id: event.user_id,
              interaction_type: "whatsapp",
              content: `Lembrete 2h enviado: ${event.title} (${eventDate})`,
              interaction_date: now.toISOString()
            });

            reminders2h++;
            console.log(`[Calendar Reminders] ✅ 2h reminder sent to lead ${lead.id}`);
          }
        } catch (error) {
          console.error(`[Calendar Reminders] Error processing 2h reminder for event ${event.id}:`, error);
          errors++;
        }
      }
    }

    // ===== PART 3: Mark no-shows (1h before event, not confirmed) =====
    const { data: unconfirmedEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("id, user_id, title, start_time, lead_id, leads(id, name, assigned_to)")
      .eq("requires_confirmation", true)
      .is("confirmed_at", null)
      .is("no_show_at", null)
      .gte("start_time", now.toISOString())
      .lte("start_time", in1h.toISOString());

    if (unconfirmedEvents && unconfirmedEvents.length > 0) {
      console.log(`[Calendar Reminders] Found ${unconfirmedEvents.length} unconfirmed events approaching`);
      
      for (const event of unconfirmedEvents) {
        try {
          const lead = (event as any).leads;
          
          await supabaseAdmin
            .from("calendar_events")
            .update({ no_show_at: now.toISOString() })
            .eq("id", event.id);

          // Create task for manual confirmation
          const assignedTo = lead?.assigned_to || event.user_id;
          
          await supabaseAdmin.from("tasks").insert({
            title: `⚠️ Confirmar Agendamento: ${lead?.name || 'Lead'}`,
            description: `O agendamento de "${event.title}" às ${new Date(event.start_time).toLocaleString('pt-PT')} não foi confirmado pela lead. Contactar manualmente para confirmar.`,
            priority: "urgent",
            status: "pending",
            assigned_to: assignedTo,
            lead_id: lead?.id,
            due_date: event.start_time
          });

          await supabaseAdmin.from("notifications").insert({
            user_id: assignedTo,
            type: "warning",
            priority: "urgent",
            title: "⚠️ Agendamento Não Confirmado",
            message: `${lead?.name || 'Lead'} não confirmou o agendamento de "${event.title}". Contactar manualmente.`
          });

          if (lead?.id) {
            await supabaseAdmin.from("interactions").insert({
              lead_id: lead.id,
              user_id: event.user_id,
              interaction_type: "note",
              content: `Agendamento não confirmado até 1h antes. Marcado para seguimento manual.`,
              interaction_date: now.toISOString()
            });
          }

          noShows++;
          console.log(`[Calendar Reminders] ⚠️ No-show marked for event ${event.id}`);
        } catch (error) {
          console.error(`[Calendar Reminders] Error marking no-show for event ${event.id}:`, error);
          errors++;
        }
      }
    }

    // ===== PART 4: Re-offer slots to qualified leads who didn't respond =====
    // Find leads that are "qualified" but have no confirmed calendar_event in the last 48h
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    const { data: qualifiedLeads } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, name, phone, assigned_to, follow_up_state, updated_at")
      .eq("follow_up_state", "qualified")
      .lt("updated_at", twoDaysAgo.toISOString());

    if (qualifiedLeads && qualifiedLeads.length > 0) {
      console.log(`[Calendar Reminders] Found ${qualifiedLeads.length} qualified leads without recent activity`);
      
      for (const lead of qualifiedLeads) {
        try {
          // Check if there's a confirmed event or pending event for this lead
          const { data: existingEvents } = await supabaseAdmin
            .from("calendar_events")
            .select("id, confirmed_at")
            .eq("lead_id", lead.id)
            .gte("start_time", now.toISOString())
            .limit(1);

          if (existingEvents && existingEvents.length > 0) continue; // Already has upcoming event

          // Check automation_paused
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("automation_paused")
            .eq("id", lead.user_id)
            .maybeSingle();

          if (profile?.automation_paused) continue;

          // Check WhatsApp consent
          const hasConsent = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);
          if (!hasConsent) {
            // No consent - create manual follow-up task instead
            const assignedTo = lead.assigned_to || lead.user_id;
            
            await supabaseAdmin.from("tasks").insert({
              title: `Seguimento Manual: ${lead.name}`,
              description: `Lead qualificada sem agendamento confirmado. Sem opt-in WhatsApp - contactar por outro meio.`,
              priority: "high",
              status: "pending",
              assigned_to: assignedTo,
              lead_id: lead.id,
              due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
            });
            
            continue;
          }

          // Re-offer slot via template (only once - don't loop)
          const result = await sendWhatsAppTemplate(
            lead.user_id,
            lead.phone,
            "reagendar_slot", // Template must be approved
            supabaseAdmin,
            lead.id
          );

          if (result.success) {
            await supabaseAdmin
              .from("leads")
              .update({ 
                updated_at: now.toISOString(),
                follow_up_state: "in_conversation" // Back to conversation to avoid re-sending
              })
              .eq("id", lead.id);

            await supabaseAdmin.from("interactions").insert({
              lead_id: lead.id,
              user_id: lead.user_id,
              interaction_type: "whatsapp",
              content: `Re-oferta de agendamento enviada (lead qualificada sem slot confirmado)`,
              interaction_date: now.toISOString()
            });

            // Create manual follow-up task as backup
            const assignedTo = lead.assigned_to || lead.user_id;
            await supabaseAdmin.from("tasks").insert({
              title: `Seguimento: ${lead.name}`,
              description: `Lead qualificada. Re-oferta de slot enviada por WhatsApp. Acompanhar resposta.`,
              priority: "medium",
              status: "pending",
              assigned_to: assignedTo,
              lead_id: lead.id,
              due_date: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
            });

            reoffers++;
            console.log(`[Calendar Reminders] ✅ Slot re-offer sent to qualified lead ${lead.id}`);
          }
        } catch (error) {
          console.error(`[Calendar Reminders] Error re-offering to lead ${lead.id}:`, error);
          errors++;
        }
      }
    }

    console.log("[Calendar Reminders] Processing complete:", {
      reminders_24h: reminders24h,
      reminders_2h: reminders2h,
      no_shows: noShows,
      reoffers: reoffers,
      errors: errors
    });

    return res.status(200).json({
      success: true,
      reminders_24h: reminders24h,
      reminders_2h: reminders2h,
      no_shows: noShows,
      reoffers: reoffers,
      errors: errors
    });

  } catch (error: any) {
    console.error("[Calendar Reminders] Fatal error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}