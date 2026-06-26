import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}` && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1. Fetch leads requiring follow-up (not opted out, not archived, not qualified)
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, phone, name, follow_up_state, created_at, temperature")
      .in("follow_up_state", ["new", "first_contact", "in_conversation", "reengagement"]);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return res.status(200).json({ success: true, processed: 0, message: "No leads to process" });
    }

    const now = new Date();
    let processed = 0;

    for (const lead of leads) {
      if (!lead.phone) continue;

      // Get last interaction to measure time elapsed
      const { data: interactions } = await supabaseAdmin
        .from("interactions")
        .select("interaction_date")
        .eq("lead_id", lead.id)
        .order("interaction_date", { ascending: false })
        .limit(1);

      const lastInteractionDate = interactions && interactions.length > 0 
        ? new Date(interactions[0].interaction_date) 
        : new Date(lead.created_at);

      const diffDays = Math.floor((now.getTime() - lastInteractionDate.getTime()) / (1000 * 3600 * 24));

      // Skip if it hasn't been a full day since last touch
      if (diffDays < 1) continue;

      // Check explicit consent before any automated outboud
      const hasConsent = await hasValidWhatsAppConsent(lead.id, supabaseAdmin);

      if (!hasConsent) {
        // If 7 days passed without response AND no consent, just archive
        if (diffDays >= 7) {
          await supabaseAdmin.from("leads").update({
            follow_up_state: "archived",
            archive_reason: "Sem resposta há 7 dias e sem opt-in."
          }).eq("id", lead.id);
        }
        continue;
      }

      // Progression Logic (1, 3, 7 days)
      let templateToSend = null;
      let newState = lead.follow_up_state;

      if (diffDays === 1 && lead.follow_up_state === "new") {
        templateToSend = "followup_day_1"; // Must match a Meta approved template
        newState = "first_contact";
      } else if (diffDays === 3 && (lead.follow_up_state === "first_contact" || lead.follow_up_state === "new")) {
        templateToSend = "followup_day_3";
        newState = "no_reply";
      } else if (diffDays >= 7 && (lead.follow_up_state === "no_reply" || lead.follow_up_state === "first_contact" || lead.follow_up_state === "in_conversation")) {
        // Day 7: Final attempt
        templateToSend = "followup_day_7_final";
        newState = "archived";
        
        await supabaseAdmin.from("leads").update({
          archive_reason: "Auto-arquivado após 7 dias sem conversão."
        }).eq("id", lead.id);
      }

      if (templateToSend) {
        console.log(`Sending template ${templateToSend} to lead ${lead.id}`);
        // Send the template
        const result = await sendWhatsAppTemplate(
          lead.user_id, 
          lead.phone, 
          templateToSend, 
          supabaseAdmin, 
          lead.id
        );

        if (result.success) {
          await supabaseAdmin.from("interactions").insert({
            lead_id: lead.id,
            user_id: lead.user_id,
            interaction_type: "whatsapp_outbound",
            content: `Cadência Automática (+${diffDays}d): Template enviado (${templateToSend})`,
            interaction_date: new Date().toISOString()
          });

          await supabaseAdmin.from("leads").update({
            follow_up_state: newState
          }).eq("id", lead.id);
          
          processed++;
        }
      }
    }

    return res.status(200).json({ success: true, processed });
  } catch (error: any) {
    console.error("Cadence error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}