import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/services/imageUploadService";

export type FrontendSettingRow = {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export interface FrontendSettings {
  logo_url?: string;
  site_title?: string;
  primary_color?: string;
  secondary_color?: string;
  // Allow other dynamic keys
  [key: string]: any;
}

export const frontendSettingsService = {
  // Get all settings (admin only)
  async getAllSettings(): Promise<FrontendSettingRow[]> {
    const { data, error } = await supabase
      .from("frontend_settings" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    if (error) throw error;
    
    // Normalize values
    const normalizedData = (data || []).map((setting: any) => ({
      ...setting,
      value: typeof setting.value === 'string' && setting.value.startsWith('"') && setting.value.endsWith('"')
        ? setting.value.slice(1, -1)
        : setting.value
    }));

    return normalizedData as unknown as FrontendSettingRow[];
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
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      settings[setting.key] = value;
    });

    return settings;
  },

  // Update setting by ID
  async updateSetting(
    id: string,
    updates: Partial<FrontendSettingRow>
  ): Promise<FrontendSettingRow> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const preparedUpdates = { ...updates };
    if ('value' in preparedUpdates) {
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
    return data as unknown as FrontendSettingRow;
  },

  // Upsert setting by Key
  async upsertSettingByKey(
    key: string,
    value: any,
    category: string = "general"
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check if exists
    const { data: existing } = await supabase
      .from("frontend_settings" as any)
      .select("id")
      .eq("key", key)
      .single();

    const payload = {
      key,
      value: String(value),
      category,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };

    if (existing) {
      const { error } = await supabase
        .from("frontend_settings" as any)
        .update(payload)
        .eq("id", (existing as any).id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("frontend_settings" as any)
        .insert(payload);
      if (error) throw error;
    }
  }
};

// --- Standalone exports for backward compatibility and page usage ---

export async function getFrontendSettings(): Promise<FrontendSettings> {
  const rows = await frontendSettingsService.getAllSettings();
  const settings: FrontendSettings = {};
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

export async function updateFrontendSettings(settings: FrontendSettings): Promise<void> {
  // Update each key
  const promises = Object.entries(settings).map(([key, value]) => {
    return frontendSettingsService.upsertSettingByKey(key, value);
  });
  await Promise.all(promises);
}

export async function uploadLogo(file: File): Promise<string> {
  const result = await uploadImage(file, "system", "logo");
  if (!result.success || !result.url) {
    throw new Error(result.error || "Falha ao fazer upload do logo");
  }
  return result.url;
}