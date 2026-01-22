import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    console.log("Starting Meta Leads Sync...");

    // Allow cron invocations (no auth required) and manual invocations
    const isCronInvocation = req.headers.get("x-cron-signature") !== null;
    const authHeader = req.headers.get("authorization");
    
    if (!isCronInvocation && !authHeader) {
      console.log("No authorization header and not a cron invocation - allowing for testing");
    }

    // Get all active integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from("meta_integrations")
      .select("*")
      .eq("is_active", true)
      .eq("webhook_subscribed", true);

    if (integrationsError) {
      throw integrationsError;
    }

    console.log(`Found ${integrations?.length || 0} active integrations`);

    let totalFetched = 0;
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const integration of integrations || []) {
      try {
        console.log(`Processing integration: ${integration.page_name} (${integration.page_id})`);

        // Get all form configs for this integration with auto_import enabled
        const { data: formConfigs } = await supabase
          .from("meta_form_configs")
          .select("*")
          .eq("integration_id", integration.id)
          .eq("auto_import", true)
          .eq("is_active", true);

        if (!formConfigs || formConfigs.length === 0) {
          console.log(`No active forms for ${integration.page_name}`);
          continue;
        }

        for (const formConfig of formConfigs) {
          // Create sync history
          const { data: syncHistory } = await supabase
            .from("meta_sync_history")
            .insert({
              user_id: integration.user_id,
              integration_id: integration.id,
              form_id: formConfig.form_id,
              sync_type: "scheduled",
              status: "running",
              started_at: new Date().toISOString(),
            })
            .select()
            .single();

          let leadsFetched = 0;
          let leadsCreated = 0;
          let leadsSkipped = 0;

          try {
            // Fetch leads from last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const sinceTimestamp = Math.floor(yesterday.getTime() / 1000);

            const response = await fetch(
              `https://graph.facebook.com/v18.0/${formConfig.form_id}/leads?` +
              `access_token=${integration.page_access_token}&` +
              `fields=id,created_time,field_data,ad_id,ad_name&` +
              `since=${sinceTimestamp}&` +
              `limit=100`
            );

            if (!response.ok) {
              throw new Error(`Meta API error: ${response.statusText}`);
            }

            const data = await response.json();
            const leads = data.data || [];
            leadsFetched = leads.length;

            console.log(`Fetched ${leadsFetched} leads from form ${formConfig.form_name}`);

            // Get field mappings
            const { data: fieldMappings } = await supabase
              .from("meta_field_mappings")
              .select("*")
              .eq("form_config_id", formConfig.id)
              .order("priority_order", { ascending: true });

            // Process each lead
            for (const metaLead of leads) {
              // Check if already exists
              const { data: existingLead } = await supabase
                .from("leads")
                .select("id")
                .eq("meta_lead_id", metaLead.id)
                .single();

              if (existingLead) {
                leadsSkipped++;
                continue;
              }

              // Map fields
              const leadData = mapMetaFieldsToLead(metaLead, fieldMappings || [], formConfig);

              // Create lead
              const { data: newLead, error: createError } = await supabase
                .from("leads")
                .insert({
                  ...leadData,
                  user_id: integration.user_id,
                  meta_lead_id: metaLead.id,
                  meta_form_id: formConfig.form_id,
                  meta_ad_id: metaLead.ad_id || null,
                  source: formConfig.default_lead_source || `Meta - ${integration.page_name}`,
                  status: formConfig.default_pipeline_stage || "new",
                })
                .select()
                .single();

              if (createError) {
                console.error("Error creating lead:", createError);
                continue;
              }

              leadsCreated++;

              // Send email notification if enabled
              if (formConfig.auto_email_notification && newLead) {
                await sendEmailNotification(integration.user_id, newLead, integration.page_name);
              }
            }

            // Update sync history - success
            await supabase
              .from("meta_sync_history")
              .update({
                status: "completed",
                leads_fetched: leadsFetched,
                leads_created: leadsCreated,
                leads_skipped: leadsSkipped,
                completed_at: new Date().toISOString(),
              })
              .eq("id", syncHistory?.id);

            totalFetched += leadsFetched;
            totalCreated += leadsCreated;
            totalSkipped += leadsSkipped;
          } catch (error: any) {
            console.error(`Error syncing form ${formConfig.form_name}:`, error);

            // Update sync history - failed
            await supabase
              .from("meta_sync_history")
              .update({
                status: "failed",
                error_message: error.message,
                leads_fetched: leadsFetched,
                leads_created: leadsCreated,
                leads_skipped: leadsSkipped,
                completed_at: new Date().toISOString(),
              })
              .eq("id", syncHistory?.id);
          }
        }
      } catch (error) {
        console.error(`Error processing integration ${integration.page_name}:`, error);
      }
    }

    console.log(`Sync completed: ${totalCreated} leads created, ${totalSkipped} skipped, ${totalFetched} total fetched`);

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          integrations_processed: integrations?.length || 0,
          leads_fetched: totalFetched,
          leads_created: totalCreated,
          leads_skipped: totalSkipped,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in Meta sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function mapMetaFieldsToLead(metaLead: any, mappings: any[], config: any) {
  const leadData: any = {
    name: "",
    email: "",
    phone: "",
  };

  const extraFields: string[] = [];

  for (const field of metaLead.field_data || []) {
    const fieldName = field.name.toLowerCase();
    const fieldValue = field.values?.[0] || "";

    const mapping = mappings.find((m: any) => m.meta_field_name === field.name);

    if (mapping) {
      leadData[mapping.crm_field_name] = fieldValue;
    } else {
      // Auto-mapping
      if (fieldName.includes("name") || fieldName === "full_name") {
        leadData.name = fieldValue;
      } else if (fieldName.includes("email")) {
        leadData.email = fieldValue;
      } else if (fieldName.includes("phone") || fieldName.includes("telefone")) {
        leadData.phone = fieldValue;
      } else if (fieldName.includes("budget") || fieldName.includes("orcamento")) {
        leadData.budget = fieldValue;
      } else if (fieldName.includes("location") || fieldName.includes("bairro") || fieldName.includes("zona")) {
        leadData.location_preference = fieldValue;
      } else if (fieldName.includes("property") || fieldName.includes("imovel") || fieldName.includes("tipo")) {
        leadData.property_type = fieldValue;
      } else {
        extraFields.push(`• ${field.name}: ${fieldValue}`);
      }
    }
  }

  if (extraFields.length > 0) {
    leadData.notes = `📝 Informações Adicionais do Formulário Meta:\n\n${extraFields.join("\n")}`;
  }

  return leadData;
}

async function sendEmailNotification(userId: string, lead: any, pageName: string) {
  try {
    // Get notification settings
    const { data: notifSettings } = await supabase
      .from("meta_notification_settings")
      .select("*")
      .single();

    if (!notifSettings || !notifSettings.notification_enabled) {
      console.log("Email notifications are disabled");
      return;
    }

    // Get user profile
    const { data: user } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (!user?.email) {
      console.log("User email not found");
      return;
    }

    // Get SMTP settings (user-specific or global)
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!smtpSettings) {
      console.log("No active SMTP settings found for user");
      return;
    }

    // Send email to consultant if enabled
    if (notifSettings.notify_consultant) {
      const { data: consultantTemplate } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "meta_lead_notification_consultant")
        .eq("is_active", true)
        .single();

      if (consultantTemplate) {
        const consultantBody = consultantTemplate.template_html
          .replace(/\{\{lead_name\}\}/g, lead.name || "N/A")
          .replace(/\{\{lead_email\}\}/g, lead.email || "N/A")
          .replace(/\{\{lead_phone\}\}/g, lead.phone || "N/A")
          .replace(/\{\{page_name\}\}/g, pageName)
          .replace(/\{\{budget\}\}/g, lead.budget || "N/A")
          .replace(/\{\{location\}\}/g, lead.location_preference || "N/A")
          .replace(/\{\{property_type\}\}/g, lead.property_type || "N/A")
          .replace(/\{\{notes\}\}/g, lead.notes || "Nenhuma nota adicional")
          .replace(/\{\{crm_url\}\}/g, `${Deno.env.get("NEXT_PUBLIC_APP_URL") || ""}/leads`);

        await sendEmailViaSMTP({
          to: user.email,
          subject: consultantTemplate.subject.replace(/\{\{lead_name\}\}/g, lead.name || "Nova Lead"),
          html: consultantBody,
          smtpSettings,
        });

        console.log(`Consultant notification sent to ${user.email}`);
      }
    }

    // Send email to client (lead) if enabled and lead has email
    if (notifSettings.notify_client && lead.email) {
      const { data: clientTemplate } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "meta_lead_notification_client")
        .eq("is_active", true)
        .single();

      if (clientTemplate) {
        const clientBody = clientTemplate.template_html
          .replace(/\{\{lead_name\}\}/g, lead.name || "Cliente")
          .replace(/\{\{consultant_name\}\}/g, user.full_name || "Nossa equipa")
          .replace(/\{\{company_name\}\}/g, "Imogest")
          .replace(/\{\{consultant_email\}\}/g, user.email)
          .replace(/\{\{consultant_phone\}\}/g, smtpSettings.reply_to || "");

        await sendEmailViaSMTP({
          to: lead.email,
          subject: clientTemplate.subject.replace(/\{\{lead_name\}\}/g, lead.name || ""),
          html: clientBody,
          smtpSettings,
        });

        console.log(`Client notification sent to ${lead.email}`);
      }
    }
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
}

async function sendEmailViaSMTP(params: {
  to: string;
  subject: string;
  html: string;
  smtpSettings: any;
}) {
  const { to, subject, html, smtpSettings } = params;

  try {
    // Basic SMTP implementation using fetch to call the SMTP API endpoint
    const response = await fetch(`${Deno.env.get("NEXT_PUBLIC_APP_URL")}/api/smtp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        smtp_host: smtpSettings.smtp_host,
        smtp_port: smtpSettings.smtp_port,
        smtp_user: smtpSettings.smtp_user,
        smtp_password: smtpSettings.smtp_password,
        from_email: smtpSettings.from_email,
        from_name: smtpSettings.from_name,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMTP API error: ${response.statusText}`);
    }

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}