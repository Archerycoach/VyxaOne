import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Tipos manuais temporários até que os tipos globais sejam atualizados
export type FrontendSetting = {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export const frontendSettingsService = {
  // Get all settings (admin only)
  async getAllSettings(): Promise<FrontendSetting[]> {
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as FrontendSetting[];
  },

  // Get public settings (everyone)
  async getPublicSettings(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .select("key, value")
      .eq("category", "public");

    if (error) throw error;

    const settings: Record<string, any> = {};
    (data as any[])?.forEach((setting: any) => {
      settings[setting.key] = setting.value;
    });

    return settings;
  },

  // Get setting by key
  async getSettingByKey(key: string): Promise<any> {
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .select("value")
      .eq("key", key)
      .single();

    if (error) throw error;
    return (data as any)?.value;
  },

  // Update setting
  async updateSetting(
    id: string,
    updates: Partial<FrontendSetting>
  ): Promise<FrontendSetting> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as FrontendSetting;
  },

  // Create setting
  async createSetting(
    setting: Omit<FrontendSetting, "id" | "updated_at" | "updated_by">
  ): Promise<FrontendSetting> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .insert({
        ...setting,
        updated_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as FrontendSetting;
  },

  // Delete setting
  async deleteSetting(id: string): Promise<void> {
    const { error } = await supabase
      .from("frontend_settings" as any)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};