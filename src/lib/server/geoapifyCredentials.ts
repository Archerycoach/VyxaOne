/**
 * Chave do Geoapify, lida das definições globais do sistema.
 *
 * NUNCA importar este ficheiro em código de browser — usa a service role.
 *
 * O Geoapify serve para os mapas estáticos dos documentos entregues ao
 * cliente (avaliação de mercado). Os pontos de interesse vêm do Overpass
 * (OpenStreetMap), que não precisa de chave.
 *
 * A chave é global e configurada uma vez pelo operador no painel de admin —
 * como a do Idealista. Cada consultor não tem de tratar disto.
 */

import { createClient } from "@supabase/supabase-js";

export async function getGeoapifyKey(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[geoapify] Configuração do servidor incompleta.");
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "geoapify_api_key")
    .maybeSingle();

  if (error) {
    console.error("[geoapify] Erro ao ler a chave:", error);
    return null;
  }

  const value = typeof data?.value === "string" ? data.value.trim() : "";
  return value || null;
}
