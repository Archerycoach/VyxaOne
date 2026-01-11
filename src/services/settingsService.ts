import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SystemSetting = Database["public"]["Tables"]["system_settings"]["Row"];
type SystemSettingInsert = Database["public"]["Tables"]["system_settings"]["Insert"];
type SystemSettingUpdate = Database["public"]["Tables"]["system_settings"]["Update"];

// Get all system settings
export const getAllSettings = async (): Promise<SystemSetting[]> => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .order("key");

  if (error) throw error;
  return data || [];
};

// Get specific setting by key
export const getSetting = async (key: string): Promise<SystemSetting | null> => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// Update or create setting
export const updateSetting = async (
  key: string,
  value: any,
  description?: string
): Promise<SystemSetting> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("User not authenticated");

  const settingData = {
    key: key,
    value: value,
    description: description,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("system_settings")
    .upsert(settingData as any, { onConflict: "key" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get modules configuration
export const getModulesConfig = async () => {
  const setting = await getSetting("modules_enabled");
  return setting?.value || {
    leads: true,
    properties: true,
    tasks: true,
    calendar: true,
    reports: true,
    chat: true,
  };
};

// Update modules configuration
export const updateModulesConfig = async (modules: Record<string, boolean>) => {
  return updateSetting(
    "modules_enabled",
    modules,
    "Enabled/disabled modules"
  );
};

// Get pipeline stages configuration
export const getPipelineConfig = async () => {
  const setting = await getSetting("pipeline_stages");
  return setting?.value || {
    buyer: ["novo", "contactado", "qualificado", "visitas", "seguimento", "negociacao", "proposta", "fechado", "perdido"],
    seller: ["novo", "contactado", "avaliacao", "seguimento", "negociacao", "listado", "vendido", "perdido"],
  };
};

// Update pipeline stages configuration
export const updatePipelineConfig = async (stages: Record<string, string[]>) => {
  return updateSetting(
    "pipeline_stages",
    stages,
    "Pipeline stages configuration"
  );
};

// Get required fields configuration
export const getRequiredFieldsConfig = async () => {
  const setting = await getSetting("required_fields");
  return setting?.value || {
    leads: ["name", "email", "type"],
    properties: ["title", "type", "price"],
    tasks: ["title", "due_date"],
  };
};

// Update required fields configuration
export const updateRequiredFieldsConfig = async (fields: Record<string, string[]>) => {
  return updateSetting(
    "required_fields",
    fields,
    "Required fields by module"
  );
};

// Get security settings
export const getSecuritySettings = async () => {
  const setting = await getSetting("security_settings");
  return setting?.value || {
    require_2fa: false,
    session_timeout: 3600,
    password_min_length: 8,
    max_login_attempts: 5,
  };
};

// Update security settings
export const updateSecuritySettings = async (settings: Record<string, any>) => {
  return updateSetting(
    "security_settings",
    settings,
    "Security configuration"
  );
};

// Get Google Calendar configuration
export const getGoogleCalendarConfig = async () => {
  const setting = await getSetting("google_calendar_config");
  return setting?.value || {
    client_id: "",
    client_secret: "",
    redirect_uri: "",
  };
};

// Update Google Calendar configuration
export const updateGoogleCalendarConfig = async (config: {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}) => {
  return updateSetting(
    "google_calendar_config",
    config,
    "Google Calendar OAuth configuration"
  );
};