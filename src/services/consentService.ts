import { supabase } from "@/integrations/supabase/client";

export async function hasValidWhatsAppConsent(leadId: string, supabaseClient = supabase): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("lead_consents" as any)
    .select("status")
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // STRICT OPT-IN: if no explicit record exists, we do NOT allow messages
  if (error || !data) return false; 
  
  return (data as any).status === "granted";
}

export async function recordConsent(
  leadId: string, 
  userId: string, 
  status: "granted" | "revoked" | "pending", 
  source: string = "system",
  supabaseClient = supabase,
  consentText?: string,
  evidenceRef?: string
): Promise<void> {
  const updates: any = {
    lead_id: leadId,
    user_id: userId,
    channel: "whatsapp",
    status,
    source,
    updated_at: new Date().toISOString()
  };

  if (consentText) updates.consent_text = consentText;
  if (evidenceRef) updates.evidence_ref = evidenceRef;

  if (status === "granted") {
    updates.granted_at = new Date().toISOString();
  } else if (status === "revoked") {
    updates.revoked_at = new Date().toISOString();
  }

  // Check if exists
  const { data: existing } = await supabaseClient
    .from("lead_consents" as any)
    .select("id")
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (existing) {
    await supabaseClient
      .from("lead_consents" as any)
      .update(updates)
      .eq("id", (existing as any).id);
  } else {
    await supabaseClient
      .from("lead_consents" as any)
      .insert(updates);
  }
}

export async function recordOptOut(leadId: string, userId: string, supabaseClient = supabase): Promise<void> {
  await recordConsent(leadId, userId, "revoked", "whatsapp_inbound", supabaseClient);
}

export async function recordEmailOptOut(
  leadId: string, 
  userId: string, 
  supabaseClient = supabase,
  evidenceRef?: string
): Promise<void> {
  const updates: any = {
    lead_id: leadId,
    user_id: userId,
    channel: "email",
    status: "revoked",
    source: "unsubscribe",
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (evidenceRef) updates.evidence_ref = evidenceRef;

  // Check if exists
  const { data: existing } = await supabaseClient
    .from("lead_consents" as any)
    .select("id")
    .eq("lead_id", leadId)
    .eq("channel", "email")
    .maybeSingle();

  if (existing) {
    await supabaseClient
      .from("lead_consents" as any)
      .update(updates)
      .eq("id", (existing as any).id);
  } else {
    await supabaseClient
      .from("lead_consents" as any)
      .insert(updates);
  }
}

export async function isWithin24hWindow(leadId: string, supabaseClient = supabase): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("interactions")
    .select("interaction_date")
    .eq("lead_id", leadId)
    .eq("interaction_type", "whatsapp_inbound")
    .order("interaction_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.interaction_date) {
    return false;
  }

  const lastInbound = new Date(data.interaction_date).getTime();
  const now = new Date().getTime();
  const diffHours = (now - lastInbound) / (1000 * 60 * 60);

  return diffHours <= 24;
}