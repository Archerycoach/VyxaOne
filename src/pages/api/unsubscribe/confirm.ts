import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { recordEmailOptOut } from "@/services/consentService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token é obrigatório." });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Find lead by email_unsub_token
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, name, email, email_opt_out")
      .eq("email_unsub_token", token)
      .maybeSingle();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Token inválido ou já utilizado." });
    }

    // Check if already opted out
    if (lead.email_opt_out) {
      return res.status(200).json({ 
        success: true, 
        message: "Já tinha cancelado a subscrição anteriormente." 
      });
    }

    // Get client IP for evidence
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || 
                     req.headers["x-real-ip"] as string || 
                     req.socket.remoteAddress || 
                     "unknown";

    const evidenceRef = `Token: ${token}, IP: ${clientIp}, Date: ${new Date().toISOString()}`;

    // Mark email_opt_out = true
    await supabaseAdmin
      .from("leads")
      .update({
        email_opt_out: true,
        email_opted_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    // Record in lead_consents (channel = email, status = revoked)
    await recordEmailOptOut(lead.id, lead.user_id, supabaseAdmin, evidenceRef);

    // Log in interactions
    await supabaseAdmin.from("interactions").insert({
      lead_id: lead.id,
      user_id: lead.user_id,
      interaction_type: "note",
      content: `Cancelamento de subscrição de email confirmado via link público (unsubscribe).`,
      interaction_date: new Date().toISOString(),
    });

    return res.status(200).json({ 
      success: true, 
      message: "Subscrição cancelada com sucesso." 
    });
  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}