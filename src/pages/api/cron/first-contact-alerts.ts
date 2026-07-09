import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface LeadWithUser {
  id: string;
  name: string;
  created_at: string;
  source: string;
  user_id: string;
  first_contact_at: string | null;
  user: {
    id: string;
    email: string;
    phone?: string;
    raw_user_meta_data?: {
      name?: string;
      first_contact_alert_minutes?: number;
      whatsapp_alerts_enabled?: boolean;
    };
  };
  profile: {
    first_contact_alert_minutes: number;
  };
}

// Se, depois do alerta inicial ao consultor, a lead continuar sem primeiro
// contacto por mais este múltiplo do tempo original, escala-se ao team_lead
// (ou, na falta de um, aos brokers).
const ESCALATION_MULTIPLIER = 3;

async function getBrokerIds(supabaseAdmin: any, cache: { ids: string[] | null }): Promise<string[]> {
  if (cache.ids) return cache.ids;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "broker")
    .eq("is_active", true);
  cache.ids = (data || []).map((p: { id: string }) => p.id);
  return cache.ids;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar segredo do cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[First Contact Alerts] Starting cron job...");

    const results = {
      checked: 0,
      alerted: 0,
      escalated: 0,
      errors: 0,
    };
    const brokerCache: { ids: string[] | null } = { ids: null };

    // Buscar leads novas sem primeiro contacto, junto com as configurações do utilizador
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select(`
        id,
        name,
        created_at,
        source,
        user_id,
        first_contact_at,
        profiles!leads_user_id_fkey (
          full_name,
          first_contact_alert_minutes,
          team_lead_id
        )
      `)
      .is("first_contact_at", null)
      .in("status", ["new", "contacted"])
      .order("created_at", { ascending: true })
      .limit(100);

    if (leadsError) {
      console.error("[First Contact Alerts] Error fetching leads:", leadsError);
      throw leadsError;
    }

    console.log(`[First Contact Alerts] Found ${leads?.length || 0} leads without first contact`);

    for (const lead of (leads || []) as any[]) {
      results.checked++;
      
      try {
        // Obter configuração do utilizador (default 15 minutos)
        const alertMinutes = lead.profiles?.first_contact_alert_minutes || 15;
        
        // Calcular tempo desde criação
        const createdAt = new Date(lead.created_at);
        const now = new Date();
        const minutesElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

        // Se ainda não passou o tempo limite, skip
        if (minutesElapsed < alertMinutes) {
          continue;
        }

        // Verificar se já foi enviado alerta para esta lead
        const { data: existingAlert } = await supabaseAdmin
          .from("first_contact_alerts")
          .select("id, escalated_at")
          .eq("lead_id", lead.id)
          .maybeSingle();

        if (existingAlert) {
          // O consultor já foi alertado — se continuar sem responder por
          // muito mais tempo, escala-se à gestão (uma única vez por lead).
          if (!existingAlert.escalated_at && minutesElapsed >= alertMinutes * ESCALATION_MULTIPLIER) {
            const targetIds = lead.profiles?.team_lead_id
              ? [lead.profiles.team_lead_id as string]
              : await getBrokerIds(supabaseAdmin, brokerCache);

            const assigneeName = lead.profiles?.full_name || "o consultor responsável";

            for (const targetId of targetIds) {
              await supabaseAdmin.from("notifications").insert({
                user_id: targetId,
                title: "⚠️ Lead sem primeiro contacto há demasiado tempo",
                message: `A lead "${lead.name}", atribuída a ${assigneeName}, continua sem primeiro contacto ${minutesElapsed} minutos depois de criada.`,
                type: "alert",
                data: {
                  lead_id: lead.id,
                  lead_name: lead.name,
                  assigned_to: lead.user_id,
                  minutes_elapsed: minutesElapsed,
                  action_url: `/leads?id=${lead.id}`,
                },
              });
            }

            await supabaseAdmin
              .from("first_contact_alerts")
              .update({ escalated_at: new Date().toISOString() })
              .eq("id", existingAlert.id);

            results.escalated++;
            console.log(`[First Contact Alerts] Escalated lead ${lead.name} (${minutesElapsed} min) to ${targetIds.length} manager(s)`);
          }
          continue;
        }

        // Buscar dados completos do utilizador
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(lead.user_id);
        
        if (!userData?.user) {
          console.warn(`[First Contact Alerts] User not found: ${lead.user_id}`);
          continue;
        }

        const user = userData.user;
        const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Consultor";
        const userPhone = user.user_metadata?.phone || user.phone;
        const whatsappEnabled = user.user_metadata?.whatsapp_alerts_enabled === true;

        // Criar notificação in-app
        await supabaseAdmin.from("notifications").insert({
          user_id: lead.user_id,
          title: "🚨 Lead Nova sem Resposta!",
          message: `A lead "${lead.name}" foi criada há ${minutesElapsed} minutos e ainda não foi contactada. Contacte urgentemente!`,
          type: "alert",
          data: {
            lead_id: lead.id,
            lead_name: lead.name,
            minutes_elapsed: minutesElapsed,
            source: lead.source,
            action_url: `/leads?id=${lead.id}`,
          },
        });

        let alertType = "notification";

        // Enviar WhatsApp se configurado
        if (whatsappEnabled && userPhone) {
          try {
            // Buscar configuração global do WhatsApp
            const { data: whatsappSettings } = await supabaseAdmin
              .from("integration_settings")
              .select("settings, is_active")
              .eq("integration_name", "whatsapp_api")
              .maybeSingle();

            if (whatsappSettings?.is_active && whatsappSettings.settings) {
              const { access_token, phone_number_id } = whatsappSettings.settings as any;
              
              if (access_token && phone_number_id) {
                const message = `🚨 *Alerta Urgente - Vyxa CRM*\n\n*Lead Nova sem Resposta!*\n\nA lead *${lead.name}* foi criada há *${minutesElapsed} minutos* e ainda não foi contactada.\n\n⏰ Contacte urgentemente!\n\nOrigem: ${lead.source || "Desconhecida"}`;

                const formattedPhone = userPhone.replace(/\D/g, '');

                const response = await fetch(
                  `https://graph.facebook.com/v19.0/${phone_number_id}/messages`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${access_token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      to: formattedPhone,
                      type: "text",
                      text: {
                        preview_url: false,
                        body: message,
                      },
                    }),
                  }
                );

                if (response.ok) {
                  alertType = "both";
                  console.log(`[First Contact Alerts] WhatsApp alert sent to ${userName}`);
                } else {
                  console.warn(`[First Contact Alerts] WhatsApp send failed:`, await response.text());
                }
              }
            }
          } catch (whatsappError) {
            console.error("[First Contact Alerts] WhatsApp error:", whatsappError);
            // Continua mesmo se WhatsApp falhar
          }
        }

        // Registar alerta enviado
        await supabaseAdmin.from("first_contact_alerts").insert({
          lead_id: lead.id,
          user_id: lead.user_id,
          alert_type: alertType,
          minutes_elapsed: minutesElapsed,
        });

        results.alerted++;
        console.log(`[First Contact Alerts] Alert sent for lead ${lead.name} (${minutesElapsed} min)`);

      } catch (error) {
        console.error(`[First Contact Alerts] Error processing lead ${lead.id}:`, error);
        results.errors++;
      }
    }

    console.log("[First Contact Alerts] Cron job completed:", results);

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("[First Contact Alerts] Cron error:", error);
    return res.status(500).json({ error: error.message });
  }
}