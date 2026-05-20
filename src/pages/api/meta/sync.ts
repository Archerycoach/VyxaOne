import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
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
        page_id: integration.page_id,
        form_id,
        sync_type: "manual",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncError) {
      console.error("Sync history error:", syncError);
      return res.status(500).json({ error: `Failed to create sync history: ${syncError.message}` });
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
        let errorMsg = response.statusText;
        try {
          const errData = await response.json();
          errorMsg = JSON.stringify(errData.error || errData);
        } catch(e) {}
        throw new Error(`Meta API error: ${errorMsg}`);
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
          .from("lead_notes")
          .select("id")
          .like("note", `%[MetaLeadID: ${metaLead.id}]%`)
          .limit(1);

        if (existingNoteByMetaId && existingNoteByMetaId.length > 0) {
          leadsSkipped++;
          continue;
        }

        // Map fields
        const leadData = mapMetaFieldsToLead(metaLead, fieldMappings || [], formConfig);
        
        // Clean numeric fields
        const numericFields = ['budget', 'budget_min', 'budget_max', 'bedrooms', 'bathrooms', 'min_area', 'max_area', 'desired_price', 'property_area', 'probability', 'lead_score', 'estimated_value'];
        for (const field of numericFields) {
          if (leadData[field] === "") {
            delete leadData[field];
          } else if (leadData[field] !== undefined) {
            const parsed = Number(leadData[field]);
            if (!isNaN(parsed)) {
              leadData[field] = parsed;
            } else {
              const digits = String(leadData[field]).replace(/[^\d.-]/g, '');
              leadData[field] = digits ? Number(digits) : null;
            }
          }
        }
        
        // Clean boolean fields
        const booleanFields = ['has_property_to_sell', 'needs_financing', 'is_development'];
        for (const field of booleanFields) {
           if (typeof leadData[field] === 'string') {
             const lower = String(leadData[field]).toLowerCase();
             leadData[field] = lower === 'true' || lower === 'sim' || lower === 'yes' || lower === '1';
           }
        }
        
        // Check if lead exists by email or phone
        let existingLead = null;
        
        if (leadData.email) {
          const { data } = await supabase
            .from("leads")
            .select("id, name, contact_id")
            .eq("user_id", user.id)
            .eq("email", leadData.email)
            .limit(1);
          if (data && data.length > 0) existingLead = data[0];
        }
        
        if (!existingLead && leadData.phone) {
          const { data } = await supabase
            .from("leads")
            .select("id, name, contact_id")
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
          
          await supabase.from("lead_notes").insert({
            lead_id: existingLead.id,
            created_by: user.id,
            note: noteContent
          });
          
          leadsCreated++; // Increment created since we successfully processed it as a note
          continue;
        }

        // Create new lead without creating a contact
        const { error: createError } = await supabase
          .from("leads")
          .insert({
            ...leadData,
            contact_id: null,
            assigned_to: user.id, // Assign the lead to the user importing it
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
          error_details: { message: error.message, stack: error.stack },
          leads_processed: leadsFetched,
          leads_created: leadsCreated,
          leads_updated: leadsUpdated,
          leads_skipped: leadsSkipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncHistory.id);

      throw error;
    }
  } catch (error: any) {
    console.error("Error in Meta sync:", error);
    return res.status(500).json({ error: error.message || "Internal server error", stack: error.stack });
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

  // Clean empty strings for constraint-sensitive fields
  if (!leadData.email || leadData.email.trim() === "") delete leadData.email;
  if (!leadData.phone || leadData.phone.trim() === "") delete leadData.phone;
  if (!leadData.name || leadData.name.trim() === "") leadData.name = "Lead Sem Nome";

  return leadData;
}