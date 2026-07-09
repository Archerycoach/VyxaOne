import { createClient } from "@supabase/supabase-js";

export interface ResolvedAiKey {
  provider: string;
  model: string;
  apiKey: string;
  scope: "user" | "org";
}

const getAdminClient = (supabaseClient?: any) =>
  supabaseClient ||
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Chave principal do utilizador (a que está marcada como ativa em
 * Definições > IA). Determina o fornecedor usado por defeito em runAI().
 */
export async function getUserActiveAiKey(
  userId: string,
  supabaseClient?: any
): Promise<ResolvedAiKey | null> {
  const supabase = getAdminClient(supabaseClient);

  const { data } = await supabase
    .from("gpt_api_keys")
    .select("provider, model, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { provider: data.provider, model: data.model, apiKey: data.api_key, scope: "user" };
}

/**
 * Chave da agência (configurada por broker/admin em Definições), usada
 * como reserva para consultores que ainda não configuraram a sua própria.
 */
export async function getOrgActiveAiKey(supabaseClient?: any): Promise<ResolvedAiKey | null> {
  const supabase = getAdminClient(supabaseClient);

  const { data } = await (supabase
    .from("org_ai_keys" as any)
    .select("provider, model, api_key")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as any);

  if (!data) return null;
  return { provider: data.provider, model: data.model, apiKey: data.api_key, scope: "org" };
}

/**
 * Chave a usar para o pedido principal de IA de um utilizador: a própria,
 * se existir, senão a da agência.
 */
export async function resolveAiKey(userId: string, supabaseClient?: any): Promise<ResolvedAiKey> {
  const supabase = getAdminClient(supabaseClient);

  const userKey = await getUserActiveAiKey(userId, supabase);
  if (userKey) return userKey;

  const orgKey = await getOrgActiveAiKey(supabase);
  if (orgKey) return orgKey;

  throw new Error(
    "Configuração de IA não encontrada. Configure a sua chave de API em Definições > IA."
  );
}

/**
 * Chave de um fornecedor específico (independente do fornecedor "principal"
 * do utilizador) — usada por capacidades que só o Gemini sabe fazer hoje
 * (áudio, embeddings) quando o fornecedor principal é a Anthropic. Procura
 * primeiro uma chave pessoal desse fornecedor, depois a da agência.
 */
export async function resolveAiKeyForProvider(
  userId: string,
  provider: string,
  supabaseClient?: any
): Promise<ResolvedAiKey | null> {
  const supabase = getAdminClient(supabaseClient);

  const { data: userKey } = await supabase
    .from("gpt_api_keys")
    .select("provider, model, api_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userKey) return { provider: userKey.provider, model: userKey.model, apiKey: userKey.api_key, scope: "user" };

  const orgKey = await getOrgActiveAiKey(supabase);
  if (orgKey && orgKey.provider === provider) return orgKey;

  return null;
}
