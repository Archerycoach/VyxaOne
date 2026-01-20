import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // VERIFICATION (Meta sends GET to validate the endpoint)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Get verify token from settings
    const { data: settings } = await supabase
      .from("meta_app_settings")
      .select("verify_token")
      .single();

    if (mode === "subscribe" && token === settings?.verify_token) {
      console.log("✅ Webhook verified successfully");
      return res.status(200).send(challenge);
    }

    console.error("❌ Webhook verification failed");
    return res.status(403).send("Forbidden");
  }

  // RECEIVE LEADS (Meta sends POST when there's a new lead)
  if (req.method === "POST") {
    const body = req.body;

    console.log("📨 Webhook received:", JSON.stringify(body, null, 2));

    try {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "leadgen") {
            const leadgenId = change.value.leadgen_id;
            const pageId = change.value.page_id;
            const formId = change.value.form_id;
            const adId = change.value.adgroup_id;

            console.log("🎯 Processing lead:", { leadgenId, pageId });

            // Find the user who owns this page
            const { data: integration } = await supabase
              .from("meta_integrations")
              .select("user_id, page_access_token, page_name")
              .eq("page_id", pageId)
              .eq("is_active", true)
              .single();

            if (!integration) {
              console.error("❌ Page not connected:", pageId);
              await logWebhook(pageId, leadgenId, formId, adId, body, "error", "Page not connected");
              continue;
            }

            // Fetch lead details from Meta API
            const leadResponse = await fetch(
              `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${integration.page_access_token}`
            );

            const leadData = await leadResponse.json();

            if (leadData.error) {
              console.error("❌ Error fetching lead:", leadData.error);
              await logWebhook(pageId, leadgenId, formId, adId, body, "error", leadData.error.message);
              continue;
            }

            // Convert field_data to object
            const leadFields: Record<string, string> = {};
            if (leadData.field_data) {
              leadData.field_data.forEach((field: any) => {
                leadFields[field.name] = field.values?.[0] || "";
              });
            }

            console.log("📋 Lead fields:", leadFields);

            // Map Meta fields to CRM fields
            const leadRecord = {
              user_id: integration.user_id,
              name: leadFields.full_name || leadFields.name || "Lead sem nome",
              email: leadFields.email || null,
              phone: leadFields.phone_number || null,
              lead_source: `Meta Lead Ads - ${integration.page_name}`,
              status: "new",
              lead_type: "buyer", // Default to buyer
              meta_lead_id: leadgenId,
              meta_form_id: formId,
              meta_ad_id: adId,
              created_at: leadData.created_time || new Date().toISOString(),
            };

            // Create lead in CRM
            const { data: newLead, error: leadError } = await supabase
              .from("leads")
              .insert(leadRecord)
              .select()
              .single();

            if (leadError) {
              console.error("❌ Error creating lead:", leadError);
              await logWebhook(pageId, leadgenId, formId, adId, body, "error", leadError.message);
              continue;
            }

            console.log("✅ Lead created:", newLead.id);

            // 4. Handle Extra Fields (Custom Questions) as a Note
            // Filter out fields already mapped
            const standardFields = ['full_name', 'name', 'email', 'phone_number'];
            const extraFields = Object.entries(leadFields)
              .filter(([key]) => !standardFields.includes(key));

            if (extraFields.length > 0) {
              const noteContent = "📋 **Dados Adicionais do Formulário Meta:**\n\n" + 
                extraFields.map(([key, value]) => `- **${key}:** ${value}`).join("\n");

              await supabase.from("notes").insert({
                lead_id: newLead.id,
                user_id: integration.user_id,
                content: noteContent
              });
              console.log("📝 Note created with extra fields");
            }

            // Send notification email to user
            await sendLeadNotificationEmail(integration.user_id, newLead, leadFields);

            // Log successful webhook
            await logWebhook(pageId, leadgenId, formId, adId, body, "success", null);
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ Webhook processing error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function logWebhook(
  pageId: string,
  leadgenId: string,
  formId: string | undefined,
  adId: string | undefined,
  payload: any,
  status: string,
  errorMessage: string | null
) {
  await supabase
    .from("meta_webhook_logs")
    .insert({
      page_id: pageId,
      leadgen_id: leadgenId,
      form_id: formId,
      ad_id: adId,
      payload: payload,
      status: status,
      error_message: errorMessage,
    });
}

async function sendLeadNotificationEmail(userId: string, lead: any, leadFields: Record<string, string>) {
  try {
    // Get user email and SMTP settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (!profile?.email) {
      console.error("User email not found");
      return;
    }

    // Get SMTP settings
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!smtpSettings) {
      console.log("SMTP not configured for user, skipping email");
      return;
    }

    // Build email content
    const fieldsHtml = Object.entries(leadFields)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Nova Lead da Meta</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1877F2;">🎯 Nova Lead Recebida da Meta!</h2>
            <p>Olá ${profile.full_name || ""},</p>
            <p>Você recebeu uma nova lead através das suas campanhas de Lead Ads na Meta (Facebook/Instagram).</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Informações da Lead:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Nome:</strong> ${lead.name}</li>
                <li><strong>Email:</strong> ${lead.email || "Não fornecido"}</li>
                <li><strong>Telefone:</strong> ${lead.phone || "Não fornecido"}</li>
                <li><strong>Origem:</strong> ${lead.lead_source}</li>
              </ul>
              
              ${fieldsHtml ? `<h4>Campos do Formulário:</h4><ul>${fieldsHtml}</ul>` : ""}
            </div>
            
            <p>
              <a href="https://www.vyxa.pt/leads" 
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

    // Send email via SMTP service
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt"}/api/smtp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId,
        to: profile.email,
        subject: "🎯 Nova Lead da Meta - Vyxa CRM",
        html: emailHtml,
      }),
    });

    console.log("✅ Notification email sent to:", profile.email);
  } catch (error) {
    console.error("Error sending notification email:", error);
  }
}