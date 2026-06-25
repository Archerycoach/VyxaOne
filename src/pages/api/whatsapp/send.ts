import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/services/whatsappService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  
  const { lead_id, phone, type, content } = req.body;
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token || (!lead_id && !phone) || !type || !content) {
    return res.status(400).json({ error: "Missing required fields or authorization" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  // Authenticate user
  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  let targetPhone = phone;
  let targetUserId = user.id;

  // If lead_id is provided, prioritize fetching data from the lead
  if (lead_id) {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("phone, user_id")
      .eq("id", lead_id)
      .single();
    
    if (!lead || !lead.phone) {
      return res.status(400).json({ error: "Lead não encontrada ou sem número de telefone associado." });
    }
    
    targetPhone = lead.phone;
    targetUserId = lead.user_id;
  }

  if (!targetPhone) {
    return res.status(400).json({ error: "Número de telefone não fornecido." });
  }

  try {
    let result;
    if (type === 'template') {
      result = await sendWhatsAppTemplate(targetUserId, targetPhone, content, supabaseAdmin);
    } else {
      result = await sendWhatsAppMessage(targetUserId, targetPhone, content, supabaseAdmin);
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    // Log interaction
    const prefix = type === 'template' ? 'Template' : 'Texto';
    await supabaseAdmin.from("interactions").insert({
      lead_id: lead_id || null,
      user_id: user.id,
      interaction_type: "whatsapp_outbound",
      content: `Para: ${targetPhone}\nEnviado (Manual - ${prefix}): ${content}`,
      interaction_date: new Date().toISOString()
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Manual WhatsApp send error:", err);
    return res.status(500).json({ error: err.message });
  }
}