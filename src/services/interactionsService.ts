import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
export type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];
export type InteractionUpdate = Database["public"]["Tables"]["interactions"]["Update"];

export interface InteractionWithDetails extends Interaction {
  lead?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  property?: {
    id: string;
    title: string;
    reference_code: string | null;
  } | null;
}

/**
 * Get all interactions for the current user
 */
export async function getInteractions(): Promise<InteractionWithDetails[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(`
      *,
      leads!interactions_lead_id_fkey (
        id,
        name,
        email,
        phone
      ),
      contacts!interactions_contact_id_fkey (
        id,
        name,
        email,
        phone
      ),
      properties!interactions_property_id_fkey (
        id,
        title,
        reference_code
      )
    `)
    .order("interaction_date", { ascending: false });

  if (error) {
    console.error("Error fetching interactions:", error);
    throw new Error("Failed to fetch interactions");
  }

  return (data || []).map((interaction) => ({
    ...interaction,
    lead: interaction.leads || null,
    contact: interaction.contacts || null,
    property: interaction.properties || null,
  }));
}

/**
 * Get interactions for a specific lead
 */
export async function getInteractionsByLead(leadId: string): Promise<InteractionWithDetails[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(`
      *,
      leads!interactions_lead_id_fkey (
        id,
        name,
        email,
        phone
      ),
      contacts!interactions_contact_id_fkey (
        id,
        name,
        email,
        phone
      ),
      properties!interactions_property_id_fkey (
        id,
        title,
        reference_code
      )
    `)
    .eq("lead_id", leadId)
    .order("interaction_date", { ascending: false });

  if (error) {
    console.error("Error fetching interactions by lead:", error);
    throw new Error("Failed to fetch lead interactions");
  }

  return (data || []).map((interaction) => ({
    ...interaction,
    lead: interaction.leads || null,
    contact: interaction.contacts || null,
    property: interaction.properties || null,
  }));
}

/**
 * Get interactions for a specific contact
 */
export async function getInteractionsByContact(contactId: string): Promise<InteractionWithDetails[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(`
      *,
      leads!interactions_lead_id_fkey (
        id,
        name,
        email,
        phone
      ),
      contacts!interactions_contact_id_fkey (
        id,
        name,
        email,
        phone
      ),
      properties!interactions_property_id_fkey (
        id,
        title,
        reference_code
      )
    `)
    .eq("contact_id", contactId)
    .order("interaction_date", { ascending: false });

  if (error) {
    console.error("Error fetching interactions by contact:", error);
    throw new Error("Failed to fetch contact interactions");
  }

  return (data || []).map((interaction) => ({
    ...interaction,
    lead: interaction.leads || null,
    contact: interaction.contacts || null,
    property: interaction.properties || null,
  }));
}

/**
 * Create a new interaction
 */
export async function createInteraction(
  interaction: Omit<InteractionInsert, "user_id">
): Promise<Interaction> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      ...interaction,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating interaction:", error);
    throw new Error("Failed to create interaction");
  }

  return data;
}

/**
 * Update an existing interaction
 */
export async function updateInteraction(
  id: string,
  updates: InteractionUpdate
): Promise<Interaction> {
  const { data, error } = await supabase
    .from("interactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating interaction:", error);
    throw new Error("Failed to update interaction");
  }

  return data;
}

/**
 * Delete an interaction
 */
export async function deleteInteraction(id: string): Promise<void> {
  const { error } = await supabase.from("interactions").delete().eq("id", id);

  if (error) {
    console.error("Error deleting interaction:", error);
    throw new Error("Failed to delete interaction");
  }
}

/**
 * Get interaction statistics
 */
export async function getInteractionStats() {
  const { data, error } = await supabase
    .from("interactions")
    .select("interaction_type, interaction_date");

  if (error) {
    console.error("Error fetching interaction stats:", error);
    throw new Error("Failed to fetch interaction statistics");
  }

  const stats = {
    total: data.length,
    byType: {} as Record<string, number>,
    last7Days: 0,
    last30Days: 0,
  };

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  data.forEach((interaction) => {
    // Count by type
    const type = interaction.interaction_type;
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Count recent interactions
    const interactionDate = new Date(interaction.interaction_date);
    if (interactionDate >= sevenDaysAgo) {
      stats.last7Days++;
    }
    if (interactionDate >= thirtyDaysAgo) {
      stats.last30Days++;
    }
  });

  return stats;
}