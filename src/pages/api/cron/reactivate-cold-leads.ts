import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";
import nodemailer from "nodemailer";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Ensure execution is authorized
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // We select leads that are not archived, opt_out or currently in_conversation
    const { data: leadsToProcess, error } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, name, email, phone, follow_up_state, updated_at, reactivation_attempts, location_preference, buy_purpose, consent_token, email_opt_out, email_unsub_token")
      .not("follow_up_state", "in", '("archived","opt_out","in_conversation")');

    if (error) throw error;

    let processed = 0;
    let emailed = 0;
    let whatsapp = 0;
    let archived = 0;

    const now = new Date().getTime();

    for (const lead of leadsToProcess || []) {
      const attempts = lead.reactivation_attempts || 0;
      const updatedAt = new Date(lead.updated_at).getTime();
      const daysSinceUpdate = (now - updatedAt) / (1000 * 3600 * 24);

      let shouldSend = false;
      let nextAttempt = attempts;
      let shouldArchive = false;

      if (lead.follow_up_state === "reengagement") {
        // Evaluate cadence: +3 days for 2nd attempt, +4 days for 3rd attempt (which means +7 days from Day 0)
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
        // Cold lead: 30 days without updates/interaction
        if (daysSinceUpdate >= 30) {
          shouldSend = true;
          nextAttempt = 1;
        }
      }

      if (shouldArchive) {
        await supabaseAdmin.from("leads").update({
          follow_up_state: "archived",
          archive_reason: "Sem resposta após 3 tentativas de reativação (cadência concluída)"
        }).eq("id", lead.id);
        archived++;
        processed++;
        continue;
      }

      if (shouldSend) {
        const hasOptIn = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);

        // 1. HAS CONSENT: Fire the WhatsApp Re-engagement Template
        if (hasOptIn && lead.phone) {
          const result = await sendWhatsAppTemplate(lead.user_id, lead.phone, "voltar_ao_radar", supabaseAdmin, lead.id);
          
          if (result.success) {
            await supabaseAdmin.from("leads").update({ 
              follow_up_state: "reengagement",
              reactivation_attempts: nextAttempt,
              updated_at: new Date().toISOString()
            }).eq("id", lead.id);
            
            await supabaseAdmin.from("interactions").insert({
              lead_id: lead.id,
              user_id: lead.user_id,
              interaction_type: "whatsapp_outbound",
              content: `Template de reativação enviado (Tentativa ${nextAttempt}/3)`,
              interaction_date: new Date().toISOString()
            });
            whatsapp++;
          }
        } 
        // 2. NO CONSENT: Never text via WA. Fire an Email requesting opt-in via Landing Page
        else if (!hasOptIn && lead.email) {
          // CRITICAL: Never send email if user opted out of emails
          if ((lead as any).email_opt_out) {
            console.log(`[Cron] Lead ${lead.id} has opted out of emails. Skipping.`);
            processed++;
            continue;
          }

          const { data: smtpSettings } = await supabaseAdmin
            .from("user_smtp_settings")
            .select("*")
            .eq("user_id", lead.user_id)
            .maybeSingle();

          if (smtpSettings && smtpSettings.smtp_host) {
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
            
            // Generate a consent token if none exists
            let token = lead.consent_token;
            if (!token) {
              token = crypto.randomUUID();
              await supabaseAdmin.from("leads").update({ consent_token: token }).eq("id", lead.id);
            }

            const optInUrl = `${appUrl}/optin/${token}`;
            
            // Use email_unsub_token for unsubscribe (independent of WhatsApp opt-in)
            let emailUnsubToken = (lead as any).email_unsub_token;
            if (!emailUnsubToken) {
              emailUnsubToken = crypto.randomUUID();
              await supabaseAdmin.from("leads").update({ email_unsub_token: emailUnsubToken }).eq("id", lead.id);
            }
            const optOutUrl = `${appUrl}/unsubscribe/${emailUnsubToken}`;
            
            // Fetch agent profile for variables
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("full_name, company_name")
              .eq("id", lead.user_id)
              .maybeSingle();
            
            const consultor = profile?.full_name || "Consultor Imobiliário";
            const empresa = profile?.company_name || "VYXA";
            
            const procuraType = (lead as any).property_type || lead.buy_purpose || "imóvel";
            const procuraLoc = lead.location_preference ? ` em ${lead.location_preference}` : "";
            const procuraStr = `${procuraType}${procuraLoc}`.trim();

            const templateName = nextAttempt === 1 ? 'optin_inicial' : (nextAttempt === 2 ? 'optin_lembrete_2' : 'optin_lembrete_final');
            
            const { data: template } = await supabaseAdmin
              .from("email_templates")
              .select("subject, html_body")
              .eq("name", templateName)
              .maybeSingle();
            
            if (template) {
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

              try {
                await transporter.sendMail({
                  from: smtpSettings.from_name ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>` : smtpSettings.from_email,
                  to: lead.email,
                  subject: subject,
                  html,
                });

                await supabaseAdmin.from("leads").update({ 
                  follow_up_state: "reengagement",
                  reactivation_attempts: nextAttempt,
                  archive_reason: "A aguardar opt-in via email",
                  updated_at: new Date().toISOString()
                }).eq("id", lead.id);

                await supabaseAdmin.from("interactions").insert({
                  lead_id: lead.id,
                  user_id: lead.user_id,
                  interaction_type: "email",
                  content: `Email de reativação enviado (${templateName} - Tentativa ${nextAttempt}/3)`,
                  interaction_date: new Date().toISOString()
                });

                emailed++;
              } catch (err) {
                console.error(`[Cron] Failed to send email to lead ${lead.id}`, err);
              }
            } else {
               console.error(`[Cron] Template ${templateName} not found.`);
            }
          } else {
            console.log(`[Cron] Lead ${lead.id} requires email opt-in but Agent ${lead.user_id} has no SMTP configured.`);
          }
        } 
        // 3. NO PHONE & NO EMAIL: Can't reach out, archive immediately
        else {
          await supabaseAdmin.from("leads").update({
            follow_up_state: "archived",
            archive_reason: "Sem telefone nem email para campanha de reativação"
          }).eq("id", lead.id);
          archived++;
        }
      }
      processed++;
    }

    return res.status(200).json({ 
      success: true, 
      results: { processed, whatsapp, emailed, archived } 
    });
  } catch (error: any) {
    console.error("Reactivation cron error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}