import { supabase } from "@/integrations/supabase/client";
import { getCachedData, setCachedData } from "@/lib/cacheUtils";
import { CacheManager, CacheKey } from "@/lib/cacheInvalidation";
import type { Database } from "@/integrations/supabase/types";
import { processLeadWorkflows } from "./workflowService";
import { getLeadQualification } from "@/lib/leadQualification";

const LEADS_CACHE_KEY = CacheKey.LEADS;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Use standard types from Database
type BaseLead = Database["public"]["Tables"]["leads"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Lead = BaseLead;
type BaseLeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadInsert = BaseLeadInsert;
type BaseLeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type LeadUpdate = BaseLeadUpdate;
type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

// LeadWithDetails extends the full Lead type from database
// and adds optional relational fields fetched via joins
export interface LeadWithDetails extends Lead {
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  interaction_count?: number;
}

export type LeadWithContacts = LeadWithDetails;

// Get current user profile with role and team_lead_id
const getCurrentUserProfile = async () => {
  // Use getSession to avoid slow network calls blocking the UI
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, team_lead_id")
    .eq("id", session.user.id)
    .single();

  if (error) throw error;
  return profile;
};

// Get team member IDs for a team lead
const getTeamMemberIds = async (teamLeadId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("team_lead_id", teamLeadId)
    .eq("role", "consultant");

  if (error) throw error;
  return (data || []).map(p => p.id);
};

// Get all leads with proper visibility rules
export const getLeads = async (useCache = false) => {
  try {
    console.log("[leadsService] getLeads called, useCache:", useCache);
    
    // Get current user profile
    const profile = await getCurrentUserProfile();
    console.log("[leadsService] Current user profile:", profile);

    // Check cache first only if useCache is true
    const cacheKey = `${LEADS_CACHE_KEY}_${profile.id}`;
    if (useCache) {
      const cached = getCachedData<Lead[]>(cacheKey, CACHE_TTL);
      if (cached) {
        console.log("[leadsService] Returning cached leads:", cached.length);
        return cached;
      }
    }

    console.log("[leadsService] Fetching leads from database...");
    
    let query = supabase
      .from("leads")
      .select(`
        *,
        contact:contacts!leads_contact_id_fkey(id, name, email, phone),
        assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
      `)
      .is("archived_at", null);

    // Apply visibility rules based on role
    if (profile.role === "admin") {
      // Admins see all leads - no filter needed
      console.log("[leadsService] Admin user - fetching all leads");
    } else if (profile.role === "team_lead") {
      // Team leads see their leads + their team members' leads
      const teamMemberIds = await getTeamMemberIds(profile.id);
      const visibleUserIds = [profile.id, ...teamMemberIds];
      console.log("[leadsService] Team lead - visible user IDs:", visibleUserIds);
      query = query.in("assigned_to", visibleUserIds);
    } else {
      // Agents see only their own leads
      console.log("[leadsService] Agent - fetching own leads only");
      query = query.eq("assigned_to", profile.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.log("[leadsService] ❌ Error fetching leads:", error);
      throw error;
    }
    
    const leads = data || [];
    console.log("[leadsService] ✅ Leads fetched successfully:", leads.length);
    
    // Cache with user-specific key
    setCachedData(cacheKey, leads);
    
    return leads;
  } catch (e) {
    console.error("[leadsService] Exception in getLeads:", e);
    throw e;
  }
};

// Alias for compatibility with existing code
export const getAllLeads = async (useCache = false): Promise<Lead[]> => {
  return getLeads(useCache);
};

// Get single lead with full details
export const getLead = async (id: string): Promise<LeadWithDetails | null> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email),
      interactions(
        *,
        user:profiles!interactions_user_id_fkey(id, full_name, email)
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as LeadWithDetails;
};

// Alias for compatibility
export const getLeadById = getLead;

// Create new lead
export const createLead = async (lead: LeadInsert): Promise<Lead> => {
  console.log("[leadsService] createLead called with:", lead);
  const { data, error } = await supabase
    .from("leads")
    .insert(lead)
    .select()
    .single();

  if (error) {
    console.error("[leadsService] createLead error:", error);
    throw error;
  }

  if (!data) {
    console.error("[leadsService] createLead failed: no data returned");
    throw new Error("Failed to create lead");
  }

  console.log("[leadsService] Lead created successfully:", data.id);

  // ✅ Run workflows via server-side unified engine (async, non-blocking)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    fetch("/api/leads/run-automations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leadId: data.id,
        triggerType: "lead_created",
      }),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!result.success && result.errors) {
          console.error("[leadsService] Workflow errors:", result.errors);
          // Create visible notification for errors
          await supabase.from("notifications").insert({
            user_id: session.user.id,
            title: "⚠️ Falha em Automações",
            message: `Algumas automações falharam para a lead ${data.name}: ${result.errors.join(", ")}`,
            notification_type: "warning",
            is_read: false,
            related_entity_id: data.id,
            related_entity_type: "lead",
          });
        } else {
          console.log("[leadsService] ✅ Workflows executed successfully");
        }
      })
      .catch((error) => {
        console.error("[leadsService] Failed to trigger workflows:", error);
        // Create visible notification for complete failure
        supabase.from("notifications").insert({
          user_id: session.user.id,
          title: "❌ Erro em Automações",
          message: `Falha ao executar automações para a lead ${data.name}: ${error.message}`,
          notification_type: "error",
          is_read: false,
          related_entity_id: data.id,
          related_entity_type: "lead",
        });
      });
  }

  return data as Lead;
};

// Update lead
export const updateLead = async (id: string, updates: Partial<LeadUpdate>) => {
  // Get current lead (linha completa) para comparar atribuição, estado do
  // pipeline e qualificação antes/depois da atualização.
  const { data: currentLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("leads")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // ✅ Send notification if lead was assigned to someone new
  if (updates.assigned_to && currentLead?.assigned_to !== updates.assigned_to) {
    try {
      await fetch("/api/notifications/new-lead-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: updates.assigned_to,
          leadId: id,
        }),
      });
      console.log("✅ New lead assignment notification sent");
    } catch (notifError) {
      console.error("⚠️ Failed to send lead assignment notification:", notifError);
      // Don't throw - notification failure shouldn't block lead update
    }
  }

  // ✅ Dispara automações de "Mudança de Estado no Pipeline" quando o status
  // (ou buyer_status/seller_status, usados na vista de Pipeline) muda.
  // Fire-and-forget: não bloqueia a atualização nem a UI.
  const PIPELINE_STATUS_FIELDS = ["status", "buyer_status", "seller_status"] as const;
  const pipelineStatusChanged = PIPELINE_STATUS_FIELDS.some(
    (field) => (updates as Record<string, unknown>)[field] !== undefined && currentLead?.[field] !== data?.[field]
  );
  if (pipelineStatusChanged) {
    processLeadWorkflows(id, "pipeline_stage_changed").catch((err) =>
      console.error("[leadsService] Failed to trigger pipeline_stage_changed workflows:", err)
    );
  }

  // ✅ Dispara automações de "Lead Qualificada" quando a lead passa a ter
  // todos os dados de qualificação relevantes preenchidos (ver
  // src/lib/leadQualification.ts). Só dispara na transição — não repete em
  // updates seguintes enquanto a lead se mantiver qualificada.
  try {
    const wasQualified = currentLead ? getLeadQualification(currentLead).missing.length === 0 : false;
    const isQualifiedNow = data ? getLeadQualification(data).missing.length === 0 : false;
    if (!wasQualified && isQualifiedNow) {
      processLeadWorkflows(id, "lead_qualified").catch((err) =>
        console.error("[leadsService] Failed to trigger lead_qualified workflows:", err)
      );
    }
  } catch (qualificationError) {
    console.error("[leadsService] Failed to evaluate qualification transition:", qualificationError);
  }

  // Invalidate cache
  CacheManager.invalidateLeadsRelated();

  return data;
};

// Archive lead (soft delete) - replaces deleteLead
export const archiveLead = async (id: string): Promise<void> => {
  const query: any = supabase.from("leads");
  
  const { error } = await query
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Restore archived lead
export const restoreLead = async (id: string): Promise<void> => {
  const query: any = supabase.from("leads");
  
  const { error } = await query
    .update({ archived_at: null })
    .eq("id", id);

  if (error) throw error;

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Permanently delete lead (hard delete) - only for archived leads
export const permanentlyDeleteLead = async (id: string): Promise<void> => {
  // First verify the lead is archived
  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("archived_at")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  
  if (!lead?.archived_at) {
    throw new Error("Apenas leads arquivadas podem ser eliminadas permanentemente. Arquive a lead primeiro.");
  }

  // Proceed with hard delete
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Get archived leads with visibility rules
export const getArchivedLeads = async (useCache = false): Promise<Lead[]> => {
  try {
    const profile = await getCurrentUserProfile();
    
    // Check cache first if enabled
    const cacheKey = `${LEADS_CACHE_KEY}_archived_${profile.id}`;
    if (useCache) {
      const cached = getCachedData<Lead[]>(cacheKey, CACHE_TTL);
      if (cached) {
        return cached;
      }
    }

    let query = supabase
      .from("leads")
      .select(`
        *,
        contact:contacts!leads_contact_id_fkey (*),
        assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
      `)
      .not("archived_at", "is", null);

    // Apply visibility rules
    if (profile.role === "admin") {
      // Admins see all archived leads
    } else if (profile.role === "team_lead") {
      const teamMemberIds = await getTeamMemberIds(profile.id);
      const visibleUserIds = [profile.id, ...teamMemberIds];
      query = query.in("assigned_to", visibleUserIds);
    } else {
      // Agents see only their own archived leads
      query = query.eq("assigned_to", profile.id);
    }

    const { data, error } = await query.order("archived_at", { ascending: false });

    if (error) throw error;
    
    const leads = (data || []) as unknown as Lead[];
    
    // Save to cache
    setCachedData(cacheKey, leads);
    
    return leads;
  } catch (e) {
    console.error("[leadsService] Exception in getArchivedLeads:", e);
    throw e;
  }
};

// Keep deleteLead as alias for backward compatibility
export const deleteLead = archiveLead;

// Add interaction to lead
export const addLeadInteraction = async (
  interaction: InteractionInsert
): Promise<Interaction> => {
  const { data, error } = await supabase
    .from("interactions")
    .insert(interaction)
    .select()
    .single();

  if (error) throw error;

  // Use the any-typed update approach here as well to avoid issues
  const queryBuilder: any = supabase.from("leads");
  await queryBuilder
    .update({ last_contact_date: new Date().toISOString() })
    .eq("id", interaction.lead_id);

  return data;
};

// Get lead interactions
export const getLeadInteractions = async (leadId: string): Promise<Interaction[]> => {
  const { data, error } = await supabase
    .from("interactions")
    .select(`
      *,
      user:profiles!interactions_user_id_fkey(id, full_name, email)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// Get pipeline stages
export const getPipelineStages = async () => {
  // Return static stages for V2 as pipeline_stages table is removed
  return [
    { id: 'new', name: 'Novo', order_index: 0 },
    { id: 'contacted', name: 'Contactado', order_index: 1 },
    { id: 'qualified', name: 'Qualificado', order_index: 2 },
    { id: 'proposal', name: 'Proposta', order_index: 3 },
    { id: 'negotiation', name: 'Negociação', order_index: 4 },
    { id: 'won', name: 'Ganho', order_index: 5 },
    { id: 'lost', name: 'Perdido', order_index: 6 }
  ];
};

export const updateLeadStatus = async (id: string, status: string) => {
  // Use any-typed query builder
  const queryBuilder: any = supabase.from("leads");
  
  const { data, error } = await queryBuilder
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  CacheManager.invalidateLeadsRelated();

  // ✅ Trigger Notion Pipeline Sync
  try {
    fetch("/api/notion/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        leadId: id, 
        status: status, 
        userId: data.user_id || (await getCurrentUserProfile()).id 
      })
    }).catch(e => console.error("[leadsService] Async Notion status sync failed:", e));
  } catch (syncError) {
    console.error("[leadsService] Error triggering Notion status sync:", syncError);
  }

  return data;
};

// Get leads by stage (for pipeline view)
export const getLeadsByStage = async (): Promise<Record<string, LeadWithDetails[]>> => {
  const leads = await getLeads();
  const stages = await getPipelineStages();

  const leadsByStage: Record<string, LeadWithDetails[]> = {};

  stages.forEach(stage => {
    leadsByStage[stage.name] = leads.filter(lead => lead.status === stage.name.toLowerCase().replace(/\s+/g, '_'));
  });

  return leadsByStage;
};

// Get lead statistics
export const getLeadStats = async () => {
  const leads = await getLeads(); // This already applies visibility rules

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    qualified: leads.filter(l => l.status === "qualified").length,
    proposal: leads.filter(l => l.status === "proposal").length,
    won: leads.filter(l => l.status === "won").length,
    lost: leads.filter(l => l.status === "lost").length,
    negotiation: leads.filter(l => l.status === "negotiation").length,
    buyers: leads.filter(l => l.lead_type === "buyer" || l.lead_type === "both").length,
    sellers: leads.filter(l => l.lead_type === "seller" || l.lead_type === "both").length,
    conversionRate: leads.length > 0 
      ? ((leads.filter(l => l.status === "won").length / leads.length) * 100).toFixed(1)
      : "0.0",
  };

  return stats;
};

// Assign lead to user
export const assignLead = async (leadId: string, userId: string): Promise<void> => {
  // Verify current user has permission to assign
  const profile = await getCurrentUserProfile();
  
  if (profile.role !== "admin" && profile.role !== "team_lead") {
    throw new Error("Não tem permissão para atribuir leads");
  }

  // If team_lead, verify they can assign to this user
  if (profile.role === "team_lead") {
    const teamMemberIds = await getTeamMemberIds(profile.id);
    const canAssignToUser = userId === profile.id || teamMemberIds.includes(userId);
    
    if (!canAssignToUser) {
      throw new Error("Não pode atribuir leads a utilizadores fora da sua equipa");
    }
  }

  // Cast query builder to bypass type checking
  const query: any = supabase.from("leads");
  
  const { error } = await query
    .update({ assigned_to: userId })
    .eq("id", leadId);

  if (error) throw error;

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};