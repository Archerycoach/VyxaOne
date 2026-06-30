/**
 * Server-only helper to fetch Idealista credentials from system_settings
 * NEVER import this file in browser/client code - it uses SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

interface IdealistaCredentials {
  apiKey: string;
  host: string;
  listEndpoint: string;
}

/**
 * Reads Idealista global credentials from system_settings using service-role client
 * Throws error if credentials are not configured
 * 
 * @returns {Promise<IdealistaCredentials>} The Idealista API credentials
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY is missing or credentials not configured
 */
export async function getIdealistaCredentials(): Promise<IdealistaCredentials> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY em falta)");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .in("key", [
      "idealista_rapidapi_key",
      "idealista_rapidapi_host",
      "idealista_rapidapi_list_endpoint"
    ]);

  if (error) {
    console.error("Error fetching Idealista credentials:", error);
    throw new Error("Erro ao obter configurações do Idealista");
  }

  const settings = (data || []) as Array<{ key: string; value: string }>;
  
  const apiKeySetting = settings.find(s => s.key === "idealista_rapidapi_key");
  const hostSetting = settings.find(s => s.key === "idealista_rapidapi_host");
  const endpointSetting = settings.find(s => s.key === "idealista_rapidapi_list_endpoint");

  if (!apiKeySetting?.value) {
    throw new Error("Chave da API do Idealista não configurada. Contacte o administrador para configurar em Admin → Integrações.");
  }

  const credentials: IdealistaCredentials = {
    apiKey: apiKeySetting.value,
    host: hostSetting?.value || "idealista2.p.rapidapi.com",
    listEndpoint: endpointSetting?.value || "/properties/list"
  };

  // Ensure endpoint starts with /
  if (!credentials.listEndpoint.startsWith('/')) {
    credentials.listEndpoint = `/${credentials.listEndpoint}`;
  }

  return credentials;
}