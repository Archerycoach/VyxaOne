import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Get current user profile
export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
};

// Update user profile
export const updateUserProfile = async (
  userId: string, 
  updates: Partial<Profile>
) => {
  // Safe update
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    throw error;
  }

  return data;
};

// Upload avatar
export const uploadAvatar = async (file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}-${Math.random()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return publicUrl;
};

// Delete avatar
export const deleteAvatar = async (avatarUrl: string) => {
  const path = avatarUrl.split("/avatars/")[1];
  if (!path) return;

  const { error } = await supabase.storage
    .from("avatars")
    .remove([`avatars/${path}`]);

  if (error) throw error;
};

// Get all users for assignment (team leads see their team, admins see everyone)
export const getUsersForAssignment = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get current user's profile to check role
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!currentProfile) throw new Error("Profile not found");

  const isAdmin = currentProfile.role === "admin";
  const isTeamLead = currentProfile.role === "team_lead";

  if (!isAdmin && !isTeamLead) {
    throw new Error("Permission denied: Only team leads and admins can assign leads");
  }

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");

  // If team lead, only show their team members
  if (isTeamLead && !isAdmin) {
    // Team leads can only see agents (not other team leads or admins)
    query = query.eq("role", "agent");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching users for assignment:", error);
    throw error;
  }

  return data || [];
};