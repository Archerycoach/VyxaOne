import { supabase } from "@/integrations/supabase/client";

export interface IntegrationConfig {
  service_name: string;
  enabled: boolean;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string;
}

export async function getIntegrationSettings(serviceName: string): Promise<IntegrationConfig | null> {
  const { data, error } = await supabase
    .from("integration_settings" as any)
    .select("*")
    .eq("service_name", serviceName)
    .single();

  if (error) {
    console.error("Error fetching integration settings:", error);
    return null;
  }

  return data as unknown as IntegrationConfig;
}

export async function updateIntegrationSettings(
  serviceName: string,
  config: Partial<IntegrationConfig>
): Promise<void> {
  const { error } = await supabase
    .from("integration_settings" as any)
    .update(config)
    .eq("service_name", serviceName);

  if (error) {
    console.error("Error updating integration settings:", error);
    throw error;
  }
}

export async function toggleIntegration(serviceName: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("integration_settings" as any)
    .update({ enabled })
    .eq("service_name", serviceName);

  if (error) {
    console.error("Error toggling integration:", error);
    throw error;
  }
}