import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Get current user profile with role and team_lead_id
export const getCurrentUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return profile;
};

// Get users that can be assigned leads (based on current user role)
export const getUsersForAssignment = async (): Promise<Profile[]> => {
  const profile = await getCurrentUserProfile();

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true);

  if (profile.role === "admin") {
    // Admins can assign to anyone (agents and team_leads)
    query = query.in("role", ["agent", "team_lead"]);
  } else if (profile.role === "team_lead") {
    // Team leads can assign to themselves or their team members
    const { data: teamMembers } = await supabase
      .from("profiles")
      .select("id")
      .eq("team_lead_id", profile.id)
      .eq("role", "agent");
    
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