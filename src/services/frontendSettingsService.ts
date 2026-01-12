import { supabase } from "@/integrations/supabase/client";

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
    
    // Normalize values - remove quotes if present
    const normalizedData = (data || []).map((setting: any) => ({
      ...setting,
      value: typeof setting.value === 'string' && setting.value.startsWith('"') && setting.value.endsWith('"')
        ? setting.value.slice(1, -1)
        : setting.value
    }));

    return normalizedData as unknown as FrontendSetting[];
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
      let value = setting.value;
      // Remove quotes if present
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      settings[setting.key] = value;
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
    
    let value = (data as any)?.value;
    // Remove quotes if present
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    return value;
  },

  // Update setting
  async updateSetting(
    id: string,
    updates: Partial<FrontendSetting>
  ): Promise<FrontendSetting> {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Prepare the value - ensure it's stored as plain string in the database
    const preparedUpdates = { ...updates };
    if ('value' in preparedUpdates) {
      // Store as plain string
      preparedUpdates.value = String(preparedUpdates.value);
    }
    
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .update({
        ...preparedUpdates,
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