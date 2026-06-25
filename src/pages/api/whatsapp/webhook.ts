import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/services/whatsappService";
import { getGoogleCalendarFreeBusy, syncEventToGoogle } from "@/lib/googleCalendar";

// Initialize Supabase Admin client to bypass RLS for webhook processing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
          const phoneNumberId = entry.changes[0]?.value?.metadata?.phone_number_id;
          
          if (!phoneNumberId) continue;

          // Find which user owns this phone number ID
          const { data: settings } = await supabaseAdmin
            .from("whatsapp_settings")
            .select("user_id")
            .eq("phone_number_id", phoneNumberId)
            .eq("is_active", true)
            .maybeSingle();

          if (!settings) {
            console.log("Ignored WhatsApp message: phone number ID not mapped to any active user", phoneNumberId);
            continue;
          }

          // Process the incoming messages
          if (entry.changes[0]?.value?.messages) {
            for (const message of entry.changes[0].value.messages) {
              const from = message.from;
              const text = message.text?.body;
              
              if (!text) continue;
              
              console.log(`Received WA message from ${from} for user ${settings.user_id}: ${text.substring(0, 50)}...`);

              // 1. Identify if 'from' matches a Lead phone number
              // Format incoming phone (usually includes country code, e.g. 351912345678)
              // We'll do a fuzzy match using ilike
              const phoneSuffix = from.length > 9 ? from.substring(from.length - 9) : from;
              
              const { data: lead } = await supabaseAdmin
                .from("leads")
                .select("id, name, temperature, status")
                .eq("user_id", settings.user_id)
                .ilike("phone", `%${phoneSuffix}%`)
                .maybeSingle();

              if (!lead) {
                console.log(`No lead found for phone ${from}`);
                continue;
              }

              // 2. Add message to Interaction history
              await supabaseAdmin.from("interactions").insert({
                lead_id: lead.id,
                user_id: settings.user_id,
                interaction_type: "whatsapp_inbound",
                content: `Recebido: ${text}`,
                interaction_date: new Date().toISOString()
              });

              // 3. Trigger the GPT agent to respond and qualify
              const openAIApiKey = process.env.OPENAI_API_KEY;
              if (openAIApiKey) {
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
                  const availability = await getGoogleCalendarFreeBusy(settings.user_id);

                  const systemPrompt = `És o assistente virtual imobiliário do consultor. Estás a falar no WhatsApp com a lead chamada ${lead.name}.
A temperatura atual desta lead é: ${lead.temperature || 'desconhecida'}.

INFORMAÇÃO DA AGENDA DO CONSULTOR:
${availability}

O teu objetivo é:
1. Responder à lead de forma natural, curta e conversacional (estilo WhatsApp).
2. Tentar perceber a urgência e qualificar a lead (Quente/Morna/Fria).
3. Se qualificares a lead como Quente (hot) ou se a lead pedir explicitamente, deves proativamente propor o agendamento de uma chamada telefónica. Para isso, analisa os espaços livres na agenda acima e sugere exatamente 3 opções claras de horários (em blocos de 30 minutos).
4. Se a lead responder e aceitar um dos horários propostos, confirma o agendamento na tua resposta e preenche o campo "schedule_meeting".
5. Deves responder em JSON estrito com o seguinte formato:
{
  "reply": "A tua resposta para enviar no WhatsApp",
  "suggested_temperature": "hot" | "warm" | "cold" | "unchanged",
  "schedule_meeting": {
    "start_time": "YYYY-MM-DDTHH:mm:ssZ",
    "end_time": "YYYY-MM-DDTHH:mm:ssZ"
  } // Preenche APENAS se a lead acabou de confirmar um horário. Deixa null ou não incluas se estiveres apenas a propor.
}
Usa "unchanged" se ainda não tiveres informação suficiente para alterar a temperatura atual.`;

                  const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${openAIApiKey}`,
                    },
                    body: JSON.stringify({
                      model: "gpt-4o-mini",
                      response_format: { type: "json_object" },
                      messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Histórico recente:\n${historyText}\n\nNova mensagem da lead: ${text}` }
                      ],
                      temperature: 0.7,
                    })
                  });

                  if (response.ok) {
                    const aiData = await response.json();
                    const result = JSON.parse(aiData.choices[0].message.content);
                    
                    if (result.reply) {
                      // Send the reply back to the lead
                      await sendWhatsAppMessage(settings.user_id, from, result.reply, supabaseAdmin);
                      
                      // Save outbound interaction
                      await supabaseAdmin.from("interactions").insert({
                        lead_id: lead.id,
                        user_id: settings.user_id,
                        interaction_type: "whatsapp_outbound",
                        content: `Enviado (IA): ${result.reply}`,
                        interaction_date: new Date().toISOString()
                      });
                    }

                    // Schedule the meeting if lead accepted a slot
                    if (result.schedule_meeting && result.schedule_meeting.start_time) {
                      const startTime = result.schedule_meeting.start_time;
                      // Default to 30 mins if end_time not provided
                      const endTime = result.schedule_meeting.end_time || new Date(new Date(startTime).getTime() + 30*60000).toISOString();

                      console.log(`[WhatsApp Webhook] IA requested to schedule meeting for lead ${lead.id} at ${startTime}`);
                      
                      const googleEventId = await syncEventToGoogle({
                        title: `Chamada com ${lead.name}`,
                        description: `Agendado automaticamente pelo Agente IA via WhatsApp.\nTelefone: ${from}`,
                        start_time: startTime,
                        end_time: endTime,
                      }, null, settings.user_id);

                      // Also register this as a new interaction/event
                      await supabaseAdmin.from("interactions").insert({
                        lead_id: lead.id,
                        user_id: settings.user_id,
                        interaction_type: "call",
                        content: `Chamada agendada automaticamente via WhatsApp para ${new Date(startTime).toLocaleString('pt-PT')}`,
                        interaction_date: new Date().toISOString()
                      });
                    }

                    // Update lead temperature if suggested
                    if (result.suggested_temperature && result.suggested_temperature !== "unchanged") {
                      await supabaseAdmin
                        .from("leads")
                        .update({ temperature: result.suggested_temperature })
                        .eq("id", lead.id);
                    }
                  }
                } catch (aiError) {
                  console.error("Error generating AI reply:", aiError);
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