import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { recordConsent } from "@/services/consentService";
import { sendWhatsAppTemplate } from "@/services/whatsappService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { token, consentText } = req.body;

  if (!token || !consentText) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Validate token and find lead with all necessary data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, follow_up_state, name, phone, property_type, location_preference, buy_purpose")
      .eq("consent_token", token)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Token inválido ou expirado." });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const evidenceRef = `token:${token}|ip:${ip}`;

    // Record formal consent
    await recordConsent(
      lead.id, 
      lead.user_id, 
      "granted", 
      "landing_optin", 
      supabaseAdmin,
      consentText,
      evidenceRef
    );

    // Update lead state: clear token (single-use), reset state to enter cadence
    await supabaseAdmin.from("leads").update({
      follow_up_state: "new",
      archive_reason: null,
      reactivation_attempts: 0,
      consent_token: null, // Token becomes invalid after use
      updated_at: new Date().toISOString()
    }).eq("id", lead.id);

    // Record interaction
    await supabaseAdmin.from("interactions").insert({
      lead_id: lead.id,
      user_id: lead.user_id,
      interaction_type: "note",
      content: `A lead deu consentimento expresso (Opt-in) para WhatsApp via Landing Page. Evidência: ${evidenceRef}`,
      interaction_date: new Date().toISOString()
    });

    // --- NEW: Send WhatsApp template immediately after opt-in ---
    
    // Check if agent has automation paused
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("automation_paused, whatsapp_module_enabled")
      .eq("id", lead.user_id)
      .maybeSingle();

    const automationPaused = profile?.automation_paused || false;
    const whatsappEnabled = profile?.whatsapp_module_enabled || false;

    // Idempotent: only send if we haven't sent first contact yet
    const alreadySentFirstContact = lead.follow_up_state === "first_contact" || 
                                    lead.follow_up_state === "in_conversation" ||
                                    lead.follow_up_state === "qualified";

    if (!automationPaused && whatsappEnabled && !alreadySentFirstContact && lead.phone) {
      console.log(`[Opt-in Confirm] Sending first contact WhatsApp template to lead ${lead.id}`);
      
      // Send first contact template (NO 24h window - lead just opted in via web)
      // Template name must be approved in Meta Business Manager: "primeiro_contacto"
      const result = await sendWhatsAppTemplate(
        lead.user_id,
        lead.phone,
        "primeiro_contacto",
        supabaseAdmin,
        lead.id
      );

      if (result.success) {
        console.log(`✅ First contact template sent successfully to ${lead.name}`);
        
        // Update follow_up_state to track that first contact was sent
        await supabaseAdmin.from("leads").update({
          follow_up_state: "first_contact"
        }).eq("id", lead.id);

        // Register as interaction
        await supabaseAdmin.from("interactions").insert({
          lead_id: lead.id,
          user_id: lead.user_id,
          interaction_type: "whatsapp",
          content: `Template de primeiro contacto enviado automaticamente após opt-in na landing page`,
          interaction_date: new Date().toISOString()
        });
      } else {
        console.error(`❌ Failed to send WhatsApp template to lead ${lead.id}:`, result.error);
        
        // CRITICAL: Don't lose the consent - it stays recorded
        // The cron job will pick up this lead later
        await supabaseAdmin.from("interactions").insert({
          lead_id: lead.id,
          user_id: lead.user_id,
          interaction_type: "note",
          content: `Tentativa de envio de WhatsApp após opt-in falhou: ${result.error}. Consentimento mantido para tentativa posterior.`,
          interaction_date: new Date().toISOString()
        });
      }
    } else {
      if (automationPaused) {
        console.log(`[Opt-in Confirm] Automation paused for user ${lead.user_id}, skipping WhatsApp send`);
      } else if (!whatsappEnabled) {
        console.log(`[Opt-in Confirm] WhatsApp module not enabled for user ${lead.user_id}`);
      } else if (alreadySentFirstContact) {
        console.log(`[Opt-in Confirm] First contact already sent to lead ${lead.id}, skipping (idempotent)`);
      } else if (!lead.phone) {
        console.log(`[Opt-in Confirm] Lead ${lead.id} has no phone number registered`);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Opt-in confirm error:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}