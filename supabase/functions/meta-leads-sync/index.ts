import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    console.log("Starting Meta Leads Sync...");

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
    const { data: user } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!user?.email) return;

    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!smtpSettings) return;

    const emailBody = `
      <h2>🎯 Nova Lead da Meta!</h2>
      <p>Uma nova lead foi capturada do formulário <strong>${pageName}</strong>.</p>
      
      <h3>Detalhes da Lead:</h3>
      <ul>
        <li><strong>Nome:</strong> ${lead.name || "N/A"}</li>
        <li><strong>Email:</strong> ${lead.email || "N/A"}</li>
        <li><strong>Telefone:</strong> ${lead.phone || "N/A"}</li>
        ${lead.budget ? `<li><strong>Orçamento:</strong> ${lead.budget}</li>` : ""}
        ${lead.location_preference ? `<li><strong>Localização:</strong> ${lead.location_preference}</li>` : ""}
        ${lead.property_type ? `<li><strong>Tipo de Imóvel:</strong> ${lead.property_type}</li>` : ""}
      </ul>
      
      <p><a href="${Deno.env.get("NEXT_PUBLIC_APP_URL")}/leads" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Lead no CRM</a></p>
    `;

    // Send email via SMTP (simplified - would use actual SMTP in production)
    console.log(`Would send email to ${user.email}: New lead from ${pageName}`);
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
}