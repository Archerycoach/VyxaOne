import { supabase } from "@/integrations/supabase/client";

// This service is meant to be called from the frontend to manage mappings, 
// and from the backend (API routes) to interact with Notion API.

export const getNotionConnection = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("notion_integrations")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getNotionMappings = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("notion_mappings")
    .select("*")
    .eq("user_id", session.user.id);

  if (error) throw error;
  return data;
};