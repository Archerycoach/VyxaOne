import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["templates"]["Row"];
type TemplateInsert = Database["public"]["Tables"]["templates"]["Insert"];
type TemplateUpdate = Database["public"]["Tables"]["templates"]["Update"];

export const getTemplates = async (type?: "email" | "whatsapp" | "sms") => {
  let query = supabase
    .from("templates")
    .select(`
      *,
      profiles (
        full_name,
        email
      )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("template_type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }

  return data;
};

export const createTemplate = async (template: TemplateInsert) => {
  const { data, error } = await supabase
    .from("templates")
    .insert(template as any)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTemplate = async (id: string, updates: {
  name?: string;
  subject?: string;
  content?: string;
  variables?: string[];
  is_active?: boolean;
}) => {
  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.subject) updateData.subject = updates.subject;
  if (updates.content) updateData.body = updates.content;
  if (updates.variables) updateData.variables = updates.variables;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await supabase
    .from("templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating template:", error);
    throw error;
  }

  return data;
};

export const deleteTemplate = async (id: string) => {
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting template:", error);
    throw error;
  }

  return true;
};