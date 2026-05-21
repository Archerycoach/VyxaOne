import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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
    let body = req.body;

    // Force parse if body is a string
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error("Failed to parse string body");
      }
    }

    console.log("📨 Webhook received:", JSON.stringify(body, null, 2));

    // ALWAYS log the raw hit to DB so we know it reached us
    try {
      await supabase.from("meta_webhook_logs").insert({
        page_id: "RAW_HIT",
        leadgen_id: "RAW_HIT",
        status: "debug",
        webhook_payload: body,
        error_message: "Raw hit received"
      });
    } catch (e) {
      console.error("Failed to log raw hit", e);
    }

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

            // Detect current app URL for email sending
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers.host;
            const appUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "https://www.vyxa.pt");

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
            
            const emailValue = leadFields.email || "";
            const phoneValue = leadFields.phone_number || leadFields.phone || "";
            
            // Check if this Meta lead was already processed
            const { data: alreadyProcessed } = await supabase
              .from("meta_webhook_logs")
              .select("id")
              .eq("leadgen_id", leadgenId)
              .eq("status", "success")
              .single();

            if (alreadyProcessed) {
              console.log("Lead already processed in logs:", leadgenId);
              continue;
            }

            // Get form config and mappings for this form
            const { data: formConfig } = await supabase
              .from("meta_form_configs")
              .select("*")
              .eq("form_id", formId)
              .eq("is_active", true)
              .single();

            let fieldMappings = [];
            if (formConfig) {
              const { data } = await supabase
                .from("meta_field_mappings")
                .select("*")
                .eq("form_config_id", formConfig.id);
              fieldMappings = data || [];
            }

            // Apply mappings to get mapped data
            const mappedData: any = { name: leadFields.full_name || leadFields.name || "Lead sem nome" };
            const extraFields: string[] = [];

            for (const [metaField, value] of Object.entries(leadFields)) {
              const fieldName = metaField.toLowerCase();
              const mapping = fieldMappings.find((m: any) => m.meta_field_name === metaField);

              if (mapping) {
                mappedData[mapping.crm_field_name] = value;
              } else {
                if (fieldName.includes("name") || fieldName === "full_name") {
                  mappedData.name = value;
                } else if (fieldName.includes("email")) {
                  mappedData.email = value;
                } else if (fieldName.includes("phone") || fieldName.includes("telefone")) {
                  mappedData.phone = value;
                } else if (fieldName.includes("budget") || fieldName.includes("orcamento") || fieldName.includes("orçamento") || fieldName.includes("investir") || fieldName.includes("valor") || fieldName.includes("preço") || fieldName.includes("preco")) {
                  mappedData.budget_max = value;
                } else if (fieldName.includes("location") || fieldName.includes("bairro") || fieldName.includes("zona") || fieldName === "city") {
                  mappedData.location_preference = value;
                } else if (fieldName.includes("tipologia") || fieldName.includes("quartos") || fieldName.includes("assoalhadas")) {
                  mappedData.typology = value; // Keep string like "T1", "T2"
                  mappedData.bedrooms = value; // Will be parsed to integer (1, 2) below
                } else if (fieldName.includes("property") || fieldName.includes("imovel") || fieldName === "tipo" || fieldName.includes("tipo de im")) {
                  mappedData.property_type = value;
                } else if (fieldName.includes("crédito") || fieldName.includes("credito") || fieldName.includes("financiamento")) {
                  mappedData.need_financing = value;
                } else if (fieldName.includes("vender") || fieldName.includes("retoma") || fieldName.includes("venda")) {
                  mappedData.has_property_to_sell = value;
                } else if (fieldName.includes("objetivo") || fieldName.includes("objectivo") || fieldName.includes("procura")) {
                  mappedData.buy_purpose = value;
                } else {
                  extraFields.push(`• ${metaField}: ${value}`);
                }
              }
            }

            let combinedNotes = mappedData.notes || "";
            const allOriginalAnswers = Object.entries(leadFields)
              .map(([k, v]) => `• ${k}: ${v}`)
              .join("\n");
            
            combinedNotes = combinedNotes 
              ? `${combinedNotes}\n\nRespostas Originais do Formulário:\n${allOriginalAnswers}` 
              : `Respostas Originais do Formulário:\n${allOriginalAnswers}`;
            
            mappedData.notes = combinedNotes;

            // Sanitize boolean fields (Portuguese "sim"/"não" -> true/false)
            for (const key of Object.keys(mappedData)) {
              if (typeof mappedData[key] === 'string') {
                const lowerVal = mappedData[key].toLowerCase().trim();
                if (lowerVal === 'sim' || lowerVal === 'yes') {
                  mappedData[key] = true;
                } else if (lowerVal === 'não' || lowerVal === 'nao' || lowerVal === 'no') {
                  mappedData[key] = null;
                } else if (key === 'buy_purpose') {
                  // Normalize intent
                  if (lowerVal.includes('habita')) mappedData[key] = 'housing';
                  else if (lowerVal.includes('invest')) mappedData[key] = 'investment';
                  else if (lowerVal.includes('secund')) mappedData[key] = 'secondary';
                } else if (key === 'property_type') {
                  // Normalize property type
                  if (lowerVal.includes('apartamento')) mappedData[key] = 'apartment';
                  else if (lowerVal.includes('moradia')) mappedData[key] = 'house';
                  else if (lowerVal.includes('terreno')) mappedData[key] = 'land';
                  else if (lowerVal.includes('comercial')) mappedData[key] = 'commercial';
                  else if (lowerVal.includes('loja')) mappedData[key] = 'store';
                }
              }
            }

            // Sanitize integer fields (e.g., convert "T1" -> 1, "2 Casas" -> 2)
            const integerFields = ['bedrooms', 'bathrooms', 'score', 'probability', 'lead_score', 'budget', 'budget_min', 'budget_max', 'price'];
            for (const field of integerFields) {
              if (mappedData[field] !== undefined && typeof mappedData[field] === 'string') {
                if (['budget', 'budget_min', 'budget_max', 'price'].includes(field)) {
                  // Special parsing for currency and budgets (e.g. "150.000€ - 200.000€", "Até 250.000")
                  // Remove spaces and dots (used as thousand separators in PT)
                  let cleanStr = mappedData[field].replace(/\s/g, '').replace(/\./g, '');
                  // Remove comma and anything after it (cents like ",00")
                  cleanStr = cleanStr.split(',')[0];
                  
                  const matches = cleanStr.match(/\d+/g);
                  if (matches && matches.length > 0) {
                    // Convert all found numbers and take the highest one (for ranges)
                    const numbers = matches.map(m => parseInt(m, 10));
                    mappedData[field] = Math.max(...numbers);
                  } else {
                    // If no numbers found, preserve original text in notes
                    mappedData.notes = mappedData.notes 
                      ? `${mappedData.notes}\n• ${field} (original): ${mappedData[field]}` 
                      : `• ${field} (original): ${mappedData[field]}`;
                    delete mappedData[field];
                  }
                } else {
                  // Regular parsing for bedrooms, bathrooms
                  const match = mappedData[field].match(/\d+/);
                  if (match) {
                    mappedData[field] = parseInt(match[0], 10);
                  } else {
                    // If it's a string but has no numbers, move it to notes and remove from mappedData
                    mappedData.notes = mappedData.notes 
                      ? `${mappedData.notes}\n• ${field} (original): ${mappedData[field]}` 
                      : `• ${field} (original): ${mappedData[field]}`;
                    delete mappedData[field];
                  }
                }
              }
            }

            const finalEmail = mappedData.email || emailValue;
            const finalPhone = mappedData.phone || phoneValue;

            // Check if lead already exists by Email or Phone
            let existingLead = null;
            
            if (finalEmail) {
              const { data } = await supabase
                .from("leads")
                .select("id, name")
                .eq("user_id", integration.user_id)
                .eq("email", finalEmail)
                .limit(1);
              if (data && data.length > 0) existingLead = data[0];
            }
            
            if (!existingLead && finalPhone) {
              const { data } = await supabase
                .from("leads")
                .select("id, name")
                .eq("user_id", integration.user_id)
                .eq("phone", finalPhone)
                .limit(1);
              if (data && data.length > 0) existingLead = data[0];
            }

            if (existingLead) {
              // Create a note with all updated form fields and notes
              const updatedFields = Object.entries(mappedData)
                .filter(([k, v]) => k !== 'notes' && v)
                .map(([k, v]) => `- **${k}:** ${v}`)
                .join("\n");

              let noteContent = `🔄 **Novo formulário submetido na Meta:**\n\n`;
              if (updatedFields) noteContent += `${updatedFields}\n\n`;
              if (mappedData.notes) noteContent += `**Notas / Campos Extra:**\n${mappedData.notes}\n\n`;
              noteContent += `[MetaLeadID: ${leadgenId}]`;

              await supabase.from("lead_notes").insert({
                lead_id: existingLead.id,
                note: noteContent,
                created_by: integration.user_id
              });
              
              console.log("✅ Note added to existing lead:", existingLead.id);
              
              // Send notification email for existing lead
              await sendLeadNotificationEmail(integration.user_id, existingLead, leadFields, true, appUrl);
              
              // Execute auto-responder workflows for existing lead who filled a new form
              await executeAutoResponderWorkflows(integration.user_id, { 
                id: existingLead.id, 
                name: existingLead.name, 
                email: finalEmail, 
                phone: finalPhone 
              });
              
              // Log successful webhook
              await logWebhook(pageId, leadgenId, formId, adId, body, "success", null);
              continue;
            }

            // Map Meta fields to CRM fields for NEW lead
            // Sanitize status to avoid "t1" invalid integer syntax if pipeline uses UUIDs or specific strings
            let safeStatus = formConfig?.default_status || "new";
            if (safeStatus === "t1" || safeStatus === "t2" || safeStatus === "t3") {
               safeStatus = "new"; // fallback to 'new' if it's a mock ID
            }

            const leadRecord = {
              ...mappedData,
              user_id: integration.user_id,
              assigned_to: formConfig?.auto_assign_to || integration.user_id, // Ensure lead is assigned to the user
              email: finalEmail || null,
              phone: finalPhone || null,
              source: `Meta Lead Ads - ${integration.page_name || 'Facebook'}`, // Set specific origin in the correct column
              status: safeStatus,
              meta_lead_id: leadgenId,
              meta_form_id: formId,
              meta_ad_id: adId,
              created_at: leadData.created_time || new Date().toISOString(),
              lead_type: formConfig?.default_lead_type || "buyer", // Strict mapping based on form config
            };

            // Remove any undefined values
            Object.keys(leadRecord).forEach(key => {
              if (leadRecord[key] === undefined) delete leadRecord[key];
            });

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

            // Create internal notification
            await supabase.from("notifications").insert({
              user_id: integration.user_id,
              title: "🎯 Nova Lead da Meta",
              content: `A lead ${newLead.name} acabou de entrar através do Facebook/Instagram.`,
              type: "lead_assignment",
              link_url: `/leads`,
              is_read: false
            });

            // Send notification email for new lead
            await sendLeadNotificationEmail(integration.user_id, newLead, leadFields, false, appUrl);

            // Execute auto-responder workflows for new lead
            await executeAutoResponderWorkflows(integration.user_id, newLead);

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
  const { error } = await supabase
    .from("meta_webhook_logs")
    .insert({
      page_id: pageId,
      leadgen_id: leadgenId,
      form_id: formId,
      ad_id: adId,
      webhook_payload: payload,
      status: status,
      error_message: errorMessage,
    });
    
  if (error) {
    console.error("Failed to insert into meta_webhook_logs:", error);
  }
}

async function sendLeadNotificationEmail(userId: string, lead: any, leadFields: Record<string, string>, isExisting: boolean = false, appUrl: string) {
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
      
    const title = isExisting ? "🔄 Lead Existente Submeteu Novo Formulário" : "🎯 Nova Lead Recebida da Meta!";
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

    // Send email DIRECTLY via nodemailer (bypassing /api/smtp/send which requires a logged-in user token)
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
      subject: isExisting ? `🔄 Formulário Meta: ${lead.name} - Vyxa CRM` : "🎯 Nova Lead da Meta - Vyxa CRM",
      html: emailHtml,
    });

    console.log("✅ Notification email sent directly to:", profile.email, "MessageID:", info.messageId);
    
  } catch (error) {
    console.error("Error sending notification email:", error);
  }
}

async function executeAutoResponderWorkflows(userId: string, lead: any) {
  try {
    if (!lead.email) {
      console.log("No email provided by lead, skipping auto-responder");
      return; 
    }

    // Fetch active workflows for this trigger
    const { data: workflows, error: wfError } = await supabase
      .from("lead_workflow_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("trigger_status", "meta_lead_created")
      .eq("enabled", true)
      .eq("action_type", "send_email");

    if (wfError || !workflows || workflows.length === 0) return;

    // Get SMTP settings
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!smtpSettings) {
      console.log("SMTP not configured for user, skipping auto-responder workflows");
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
      tls: {
        rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
      },
    });

    for (const workflow of workflows) {
      const config = workflow.action_config || {};
      let subject = config.subject || "Obrigado pelo seu contacto";
      let body = config.body || "Recebemos a sua mensagem.";

      // Personalize content
      subject = subject
        .replace(/{nome}/g, lead.name || "")
        .replace(/{email}/g, lead.email || "")
        .replace(/{telefone}/g, lead.phone || "");
        
      body = body
        .replace(/{nome}/g, lead.name || "")
        .replace(/{email}/g, lead.email || "")
        .replace(/{telefone}/g, lead.phone || "");

      // Send to the LEAD
      await transporter.sendMail({
        from: smtpSettings.from_name
          ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
          : smtpSettings.from_email,
        to: lead.email,
        subject: subject,
        html: body.replace(/\n/g, "<br>"),
        text: body,
      });
      
      console.log(`✅ Auto-responder sent to ${lead.email} for workflow ${workflow.name}`);
      
      // Log execution history
      await supabase.from("workflow_executions").insert({
        workflow_id: workflow.id,
        lead_id: lead.id,
        user_id: userId,
        status: "completed",
        executed_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error executing auto-responder workflows:", error);
  }
}