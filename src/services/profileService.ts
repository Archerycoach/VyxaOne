import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Get current user profile with role and team_lead_id
export const getCurrentUserProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return profile;
};

// Get users that can be assigned leads (based on current user role) — usado
// pela configuração de atribuição automática de formulários Meta e por
// workflows de automação, onde o âmbito por equipa continua a fazer sentido.
export const getUsersForAssignment = async (): Promise<Profile[]> => {
  const profile = await getCurrentUserProfile();

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true);

  if (profile.role === "admin" || profile.role === "broker") {
    // Admins/brokers can assign to anyone (agents and team_leads)
    query = query.in("role", ["consultant", "team_lead"]);
  } else if (profile.role === "team_lead") {
    // Team leads can assign to themselves or their team members
    const { data: teamMembers } = await supabase
      .from("profiles")
      .select("id")
      .eq("team_lead_id", profile.id)
      .eq("role", "consultant");

    const teamMemberIds = teamMembers?.map(m => m.id) || [];
    const assignableIds = [profile.id, ...teamMemberIds];

    query = query.in("id", assignableIds);
  } else {
    // Agents can only see themselves (though they shouldn't have assign permission)
    query = query.eq("id", profile.id);
  }

  const { data, error } = await query.order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Membros da MESMA equipa/agência do utilizador atual, para transferir ou
// partilhar uma lead. Numa instância partilhada (pública) com várias agências
// na mesma base de dados, isto NUNCA pode devolver utilizadores de outras
// equipas — evita enviar uma lead a alguém que não se conhece / de outro
// cliente. O âmbito é definido pela hierarquia (team_lead_id / manager_id).
export const getTeamMembersForTransfer = async (): Promise<Profile[]> => {
  const profile = await getCurrentUserProfile();

  const ids = new Set<string>();

  if (profile.role === "admin" || profile.role === "broker") {
    // A sua agência: team_leads que gere (+ consultores desses) e consultores
    // diretamente sob si.
    const { data: leads } = await supabase.from("profiles").select("id").eq("manager_id", profile.id);
    const leadIds = (leads || []).map((l: any) => l.id);
    leadIds.forEach((id: string) => ids.add(id));
    if (leadIds.length > 0) {
      const { data: sub } = await supabase.from("profiles").select("id").in("team_lead_id", leadIds);
      (sub || []).forEach((c: any) => ids.add(c.id));
    }
    const { data: direct } = await supabase.from("profiles").select("id").eq("team_lead_id", profile.id);
    (direct || []).forEach((c: any) => ids.add(c.id));
  } else {
    // team_lead: a sua equipa. consultor: os colegas da mesma equipa + o líder.
    const anchor = profile.role === "team_lead" ? profile.id : profile.team_lead_id;
    if (anchor) {
      ids.add(anchor);
      const { data: peers } = await supabase.from("profiles").select("id").eq("team_lead_id", anchor);
      (peers || []).forEach((c: any) => ids.add(c.id));
    }
  }

  ids.delete(profile.id); // nunca a si próprio
  if (ids.size === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", Array.from(ids))
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Alias mantido por compatibilidade — agora com âmbito de equipa (ver acima).
export const getAllActiveUsersForLeadTransfer = getTeamMembersForTransfer;

// Get profile by ID
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
};

// Update profile
export const updateProfile = async (userId: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Compatibility aliases for existing code
export const getUserProfile = getCurrentUserProfile;

export const updateUserProfile = async (updates: Partial<Profile>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return updateProfile(user.id, updates);
};