import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/services/whatsappService";
import { hasValidWhatsAppConsent } from "@/services/consentService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing authorization" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { leadIds, templateName = "reativacao_radar" } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: "No leads provided" });
  }

  try {
    const results = {
      success: 0,
      skippedNoConsent: 0,
      failed: 0
    };

    // Process leads in batch
    for (const leadId of leadIds) {
      // Check consent first
      const hasConsent = await hasValidWhatsAppConsent(leadId, supabaseAdmin);
      
      if (!hasConsent) {
        results.skippedNoConsent++;
        // Update archive reason if missing
        await supabaseAdmin.from("leads").update({
          archive_reason: "Ignorado em reativação: Sem consentimento (opt-out)."
        }).eq("id", leadId);
        continue;
      }

      // Fetch lead to get phone
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("phone")
        .eq("id", leadId)
        .single();

      if (!lead || !lead.phone) {
        results.failed++;
        continue;
      }

      // Send the reactivation template
      const result = await sendWhatsAppTemplate(user.id, lead.phone, templateName, supabaseAdmin, leadId);

      if (result.success) {
        results.success++;
        
        // Log interaction
        await supabaseAdmin.from("interactions").insert({
          lead_id: leadId,
          user_id: user.id,
          interaction_type: "whatsapp_outbound",
          content: `Reativação em Lote: Template ${templateName} enviado com opções: "Interessado" / "Sem Interesse".`,
          interaction_date: new Date().toISOString()
        });

        // Update state to reengagement
        await supabaseAdmin.from("leads").update({
          follow_up_state: "reengagement",
          archive_reason: null // Clear previous archive reason if any
        }).eq("id", leadId);
      } else {
        results.failed++;
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}