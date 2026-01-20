import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface MetaAppSettings {
  id?: string;
  app_id: string;
  app_secret: string;
  verify_token: string;
  webhook_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MetaIntegration {
  id: string;
  user_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  token_expires_at: string;
  is_active: boolean;
  webhook_subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaFormConfig {
  id: string;
  user_id: string;
  integration_id: string;
  form_id: string;
  form_name: string;
  auto_import: boolean;
  auto_email_notification: boolean;
  default_pipeline_stage: string | null;
  default_lead_source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaFieldMapping {
  id: string;
  form_config_id: string;
  meta_field_name: string;
  crm_field_name: string;
  field_type: string;
  is_required: boolean;
  default_value: string | null;
  transform_rule: string | null;
  priority_order: number;
  created_at: string;
  updated_at: string;
}

export interface MetaSyncHistory {
  id: string;
  user_id: string;
  integration_id: string;
  form_id: string | null;
  sync_type: string;
  status: string;
  leads_fetched: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface MetaLeadData {
  id: string;
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  form_name?: string;
}

// ============================================
// META APP SETTINGS (ADMIN)
// ============================================

export const getMetaAppSettings = async (): Promise<MetaAppSettings | null> => {
  const { data, error } = await supabase
    .from("meta_app_settings" as any)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data as unknown as MetaAppSettings;
};

export const updateMetaAppSettings = async (settings: Partial<MetaAppSettings>) => {
  const { data, error } = await supabase
    .from("meta_app_settings" as any)
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id || "")
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MetaAppSettings;
};

// ============================================
// META INTEGRATIONS (USER PAGES)
// ============================================

export const getUserMetaIntegrations = async (): Promise<MetaIntegration[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("meta_integrations" as any)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as MetaIntegration[];
};

export const deleteMetaIntegration = async (integrationId: string) => {
  const { error } = await supabase
    .from("meta_integrations" as any)
    .delete()
    .eq("id", integrationId);

  if (error) throw error;
};

// ============================================
// META FORM CONFIGS
// ============================================

export const getFormConfigs = async (integrationId?: string): Promise<MetaFormConfig[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("meta_form_configs" as any)
    .select("*")
    .eq("user_id", user.id);

  if (integrationId) {
    query = query.eq("integration_id", integrationId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as MetaFormConfig[];
};

export const createOrUpdateFormConfig = async (config: Partial<MetaFormConfig>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const configData = {
    ...config,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (config.id) {
    // Update existing
    const { data, error } = await supabase
      .from("meta_form_configs" as any)
      .update(configData)
      .eq("id", config.id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as MetaFormConfig;
  } else {
    // Create new
    const { data, error } = await supabase
      .from("meta_form_configs" as any)
      .insert(configData)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as MetaFormConfig;
  }
};

export const deleteFormConfig = async (configId: string) => {
  const { error } = await supabase
    .from("meta_form_configs" as any)
    .delete()
    .eq("id", configId);

  if (error) throw error;
};

// ============================================
// META FIELD MAPPINGS
// ============================================

export const getFieldMappings = async (formConfigId: string): Promise<MetaFieldMapping[]> => {
  const { data, error } = await supabase
    .from("meta_field_mappings" as any)
    .select("*")
    .eq("form_config_id", formConfigId)
    .order("priority_order", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as MetaFieldMapping[];
};

export const saveFieldMappings = async (formConfigId: string, mappings: Partial<MetaFieldMapping>[]) => {
  // Delete existing mappings
  await supabase
    .from("meta_field_mappings" as any)
    .delete()
    .eq("form_config_id", formConfigId);

  // Insert new mappings
  const mappingsData = mappings.map((m, index) => ({
    ...m,
    form_config_id: formConfigId,
    priority_order: m.priority_order || index,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("meta_field_mappings" as any)
    .insert(mappingsData)
    .select();

  if (error) throw error;
  return (data || []) as unknown as MetaFieldMapping[];
};

// ============================================
// META SYNC HISTORY
// ============================================

export const getSyncHistory = async (integrationId?: string): Promise<MetaSyncHistory[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("meta_sync_history" as any)
    .select("*")
    .eq("user_id", user.id);

  if (integrationId) {
    query = query.eq("integration_id", integrationId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as unknown as MetaSyncHistory[];
};

export const createSyncHistory = async (syncData: Partial<MetaSyncHistory>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("meta_sync_history" as any)
    .insert({
      ...syncData,
      user_id: user.id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MetaSyncHistory;
};

export const updateSyncHistory = async (syncId: string, updates: Partial<MetaSyncHistory>) => {
  const { data, error } = await supabase
    .from("meta_sync_history" as any)
    .update(updates)
    .eq("id", syncId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MetaSyncHistory;
};

// ============================================
// META GRAPH API - FETCH LEADS
// ============================================

export const fetchMetaLeadData = async (leadId: string, accessToken: string): Promise<MetaLeadData> => {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${leadId}?access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch lead data: ${response.statusText}`);
  }

  return await response.json();
};

export const fetchFormLeads = async (
  formId: string,
  accessToken: string,
  limit: number = 100
): Promise<MetaLeadData[]> => {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${accessToken}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch form leads: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
};

export const fetchPageForms = async (pageId: string, accessToken: string) => {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch page forms: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
};

// ============================================
// WEBHOOK LOGGING
// ============================================

export const logWebhook = async (
  pageId: string,
  leadgenId: string,
  formId: string | null,
  adId: string | null,
  payload: any,
  status: string,
  errorMessage: string | null
) => {
  const { error } = await supabase
    .from("meta_webhook_logs" as any)
    .insert({
      page_id: pageId,
      leadgen_id: leadgenId,
      form_id: formId,
      ad_id: adId,
      payload,
      status,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error logging webhook:", error);
  }
};