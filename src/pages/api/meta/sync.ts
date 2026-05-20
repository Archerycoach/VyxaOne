import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/meta/sync
 * Sincronização manual de leads de um formulário específico
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { integration_id, form_id, days_back = 7 } = req.body;

    if (!integration_id || !form_id) {
      return res.status(400).json({ error: "integration_id and form_id are required" });
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from("meta_integrations")
      .select("*")
      .eq("id", integration_id)
      .eq("user_id", user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Get form config
    const { data: formConfig } = await supabase
      .from("meta_form_configs")
      .select("*")
      .eq("form_id", form_id)
      .eq("user_id", user.id)
      .single();

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from("meta_field_mappings")
      .select("*")
      .eq("form_config_id", formConfig?.id || "")
      .order("priority_order", { ascending: true });

    // Create sync history entry
    const { data: syncHistory, error: syncError } = await supabase
      .from("meta_sync_history")
      .insert({
        user_id: user.id,
        integration_id,
        form_id,
        sync_type: "manual",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncError) {
      return res.status(500).json({ error: "Failed to create sync history" });
    }

    let leadsFetched = 0;
    let leadsCreated = 0;
    const leadsUpdated = 0;
    let leadsSkipped = 0;

    try {
      // Fetch leads from Meta
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days_back);
      const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${form_id}/leads?` +
        `access_token=${integration.page_access_token}&` +
        `fields=id,created_time,field_data,ad_id,ad_name,form_id&` +
        `since=${sinceTimestamp}&` +
        `limit=100`
      );

      if (!response.ok) {
        throw new Error(`Meta API error: ${response.statusText}`);
      }

      const data = await response.json();
      const leads = data.data || [];
      leadsFetched = leads.length;

      // Process each lead
      for (const metaLead of leads) {
        // Check if lead already exists by meta_lead_id
        const { data: existingLeadByMetaId } = await supabase
          .from("leads")
          .select("id")
          .eq("meta_lead_id", metaLead.id)
          .single();

        if (existingLeadByMetaId) {
          leadsSkipped++;
          continue;
        }
        
        // Also check if we already added a note for this meta_lead_id
        const { data: existingNoteByMetaId } = await supabase
          .from("notes")
          .select("id")
          .like("content", `%[MetaLeadID: ${metaLead.id}]%`)
          .limit(1);

        if (existingNoteByMetaId && existingNoteByMetaId.length > 0) {
          leadsSkipped++;
          continue;
        }

        // Map fields
        const leadData = mapMetaFieldsToLead(metaLead, fieldMappings || [], formConfig);
        
        // Check if lead exists by email or phone
        let existingLead = null;
        
        if (leadData.email) {
          const { data } = await supabase
            .from("leads")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("email", leadData.email)
            .limit(1);
          if (data && data.length > 0) existingLead = data[0];
        }
        
        if (!existingLead && leadData.phone) {
          const { data } = await supabase
            .from("leads")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("phone", leadData.phone)
            .limit(1);
          if (data && data.length > 0) existingLead = data[0];
        }

        if (existingLead) {
          // Add note to existing lead with all form fields
          const updatedFields = Object.entries(leadData)
            .filter(([k, v]) => k !== 'notes' && v)
            .map(([k, v]) => `- **${k}:** ${v}`)
            .join("\n");

          let noteContent = `🔄 **Novo formulário submetido na Meta:**\n\n`;
          if (updatedFields) noteContent += `${updatedFields}\n\n`;
          if (leadData.notes) noteContent += `**Notas / Campos Extra:**\n${leadData.notes}\n\n`;
          noteContent += `[MetaLeadID: ${metaLead.id}]`;
          
          await supabase.from("notes").insert({
            lead_id: existingLead.id,
            user_id: user.id,
            content: noteContent
          });
          
          leadsCreated++; // Increment created since we successfully processed it as a note
          continue;
        }

        // Create new lead
        const { error: createError } = await supabase
          .from("leads")
          .insert({
            ...leadData,
            notes: leadData.notes ? `${leadData.notes}\n\n[MetaLeadID: ${metaLead.id}]` : `[MetaLeadID: ${metaLead.id}]`,
            user_id: user.id,
            meta_lead_id: metaLead.id,
            meta_form_id: form_id,
            meta_ad_id: metaLead.ad_id || null,
            source: formConfig?.default_lead_source || `Meta - ${integration.page_name}`,
            status: formConfig?.default_pipeline_stage || "new",
          });

        if (createError) {
          console.error("Error creating lead:", createError);
          continue;
        }

        leadsCreated++;
      }

      // Update sync history
      await supabase
        .from("meta_sync_history")
        .update({
          status: "completed",
          leads_processed: leadsFetched,
          leads_created: leadsCreated,
          leads_updated: leadsUpdated,
          leads_skipped: leadsSkipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncHistory.id);

      return res.status(200).json({
        success: true,
        sync_id: syncHistory.id,
        results: {
          fetched: leadsFetched,
          created: leadsCreated,
          updated: leadsUpdated,
          skipped: leadsSkipped,
        },
      });
    } catch (error: any) {
      // Update sync history with error
      await supabase
        .from("meta_sync_history")
        .update({
          status: "failed",
          error_details: { message: error.message },
          leads_processed: leadsFetched,
          leads_created: leadsCreated,
          leads_updated: leadsUpdated,
          leads_skipped: leadsSkipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncHistory.id);

      throw error;
    }
  } catch (error) {
    console.error("Error in Meta sync:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

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

    // Check if there's a custom mapping
    const mapping = mappings.find((m: any) => m.meta_field_name === field.name);

    if (mapping) {
      // Use custom mapping
      leadData[mapping.crm_field_name] = fieldValue;
    } else {
      // Auto-mapping for standard fields
      if (fieldName.includes("name") || fieldName === "full_name") {
        leadData.name = fieldValue;
      } else if (fieldName.includes("email")) {
        leadData.email = fieldValue;
      } else if (fieldName.includes("phone") || fieldName.includes("telefone")) {
        leadData.phone = fieldValue;
      } else if (fieldName.includes("budget") || fieldName.includes("orcamento")) {
        leadData.budget = fieldValue;
      } else if (fieldName.includes("location") || fieldName.includes("bairro") || fieldName.includes("zona") || fieldName === "city") {
        leadData.location_preference = fieldValue;
      } else if (fieldName.includes("property") || fieldName.includes("imovel") || fieldName.includes("tipo")) {
        leadData.property_type = fieldValue;
      } else {
        // Extra field - add to notes
        extraFields.push(`• ${field.name}: ${fieldValue}`);
      }
    }
  }

  // Combine mapped notes and extra fields
  let combinedNotes = leadData.notes || "";
  if (extraFields.length > 0) {
    const extraContent = extraFields.join("\n");
    combinedNotes = combinedNotes ? `${combinedNotes}\n\n${extraContent}` : extraContent;
  }
  if (combinedNotes) {
    leadData.notes = combinedNotes;
  }

  return leadData;
}