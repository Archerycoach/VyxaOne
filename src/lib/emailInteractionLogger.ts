/**
 * Email Interaction Logger
 * Centralized utility to log email sends as interactions and update lead contact tracking
 */

import { supabase } from "@/integrations/supabase/client";

interface EmailInteractionData {
  leadId?: string;
  contactId?: string;
  userId: string;
  to?: string | string[];
  subject: string;
  body?: string;
  outcome?: string;
  updateLastContact?: boolean; // Defaults to true, if false it won't update the lead's last_contact_date
}

/**
 * Log an email send as an interaction and update lead/contact last_contact fields
 * This should be called after successful email delivery
 */
export async function logEmailInteraction(data: EmailInteractionData): Promise<void> {
  try {
    const now = new Date().toISOString();
    const outcome = data.outcome || "Email enviado";
    
    // Format recipients
    const toRecipients = Array.isArray(data.to) ? data.to.join(', ') : (data.to || 'Desconhecido');

    // 1. Create interaction record
    const interactionData: any = {
      interaction_type: "email",
      interaction_date: now,
      outcome: outcome,
      subject: data.subject,
      content: `Para: ${toRecipients}\nAssunto: ${data.subject}${data.body ? `\n\n${data.body.substring(0, 500)}` : ""}`,
      user_id: data.userId,
    };

    if (data.leadId) {
      interactionData.lead_id = data.leadId;
    }

    if (data.contactId) {
      interactionData.contact_id = data.contactId;
    }

    const { error: interactionError } = await supabase
      .from("interactions")
      .insert(interactionData);

    if (interactionError) {
      console.error("Failed to log email interaction:", interactionError);
      // Don't throw - email was already sent successfully
    }

    // 2. Update lead's last_contact_date and last_contact_outcome
    if (data.leadId && data.updateLastContact !== false) {
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          last_contact_date: now,
          last_contact_outcome: outcome,
        })
        .eq("id", data.leadId);

      if (leadError) {
        console.error("Failed to update lead last_contact:", leadError);
      }
    }
  } catch (error) {
    console.error("Error in logEmailInteraction:", error);
    // Don't throw - email was already sent successfully
  }
}

/**
 * Server-side version using service role key (for API routes)
 */
export async function logEmailInteractionServer(
  supabaseAdmin: any,
  data: EmailInteractionData
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const outcome = data.outcome || "Email enviado";

    // Format recipients
    const toRecipients = Array.isArray(data.to) ? data.to.join(', ') : (data.to || 'Desconhecido');

    // 1. Create interaction record
    const interactionData: any = {
      interaction_type: "email",
      interaction_date: now,
      outcome: outcome,
      subject: data.subject,
      content: `Para: ${toRecipients}\nAssunto: ${data.subject}${data.body ? `\n\n${data.body.substring(0, 500)}` : ""}`,
      user_id: data.userId,
    };

    if (data.leadId) {
      interactionData.lead_id = data.leadId;
    }

    if (data.contactId) {
      interactionData.contact_id = data.contactId;
    }

    const { error: interactionError } = await supabaseAdmin
      .from("interactions")
      .insert(interactionData);

    if (interactionError) {
      console.error("Failed to log email interaction:", interactionError);
    }

    // 2. Update lead's last_contact_date and last_contact_outcome
    if (data.leadId && data.updateLastContact !== false) {
      const { error: leadError } = await supabaseAdmin
        .from("leads")
        .update({
          last_contact_date: now,
          last_contact_outcome: outcome,
        })
        .eq("id", data.leadId);

      if (leadError) {
        console.error("Failed to update lead last_contact:", leadError);
      }
    }
  } catch (error) {
    console.error("Error in logEmailInteractionServer:", error);
  }
}