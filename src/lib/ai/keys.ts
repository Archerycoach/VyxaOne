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

const INTEGRATED_AI_MISSING_TITLE = "⚠️ IA integrada sem chave configurada";

/**
 * Indica se o plano ativo/trial do utilizador inclui IA integrada. Só os planos
 * marcados com `ai_included = true` dão direito à chave do admin/agência.
 * Falha em segurança (retorna false) se a coluna ainda não existir ou a query
 * falhar — nesse caso o utilizador usa a sua própria chave.
 */
export async function isAiIncludedForUser(userId: string, supabaseClient?: any): Promise<boolean> {
  const supabase = getAdminClient(supabaseClient);
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (!sub?.plan_id) return false;

    const { data: plan } = await (supabase
      .from("subscription_plans")
      .select("ai_included")
      .eq("id", sub.plan_id)
      .maybeSingle() as any);

    return !!plan?.ai_included;
  } catch (error) {
    console.error("[ai/keys] isAiIncludedForUser falhou (a assumir sem IA integrada):", error);
    return false;
  }
}

/**
 * Notifica o(s) admin(s) de que um utilizador com plano de IA integrada tentou
 * usar a IA mas não há chave da agência configurada. Deduplicado a 24h para não
 * inundar. Best-effort: nunca lança.
 */
async function notifyAdminsMissingIntegratedAiKey(supabase: any, requesterUserId: string): Promise<void> {
  try {
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
    if (!admins?.length) return;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    for (const admin of admins as { id: string }[]) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", admin.id)
        .eq("title", INTEGRATED_AI_MISSING_TITLE)
        .eq("is_read", false)
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      // Inserimos apenas colunas garantidas (o tipo da notificação fica no
      // default), para ser robusto ao drift da tabela notifications.
      await supabase.from("notifications").insert({
        user_id: admin.id,
        title: INTEGRATED_AI_MISSING_TITLE,
        message:
          "Um utilizador com plano de IA integrada tentou usar a IA, mas ainda não há chave de IA da agência configurada. Configure-a em Definições > IA para ativar a IA integrada.",
        data: { kind: "integrated_ai_key_missing", requester_user_id: requesterUserId, action_url: "/settings" },
      });
    }
  } catch (error) {
    console.error("[ai/keys] Falha ao notificar admin sobre chave de IA integrada em falta:", error);
  }
}

/**
 * Chave a usar para o pedido principal de IA de um utilizador, em função do plano:
 * - Plano com IA integrada (ai_included) -> usa SEMPRE a chave do admin/agência,
 *   nunca a do consultor. Se o admin não a configurou, alerta-o e falha.
 * - Caso contrário (sem plano, ou plano sem IA) -> usa a própria chave do
 *   consultor, sem reserva na do admin.
 */
export async function resolveAiKey(userId: string, supabaseClient?: any): Promise<ResolvedAiKey> {
  const supabase = getAdminClient(supabaseClient);

  const aiIncluded = await isAiIncludedForUser(userId, supabase);

  if (aiIncluded) {
    const orgKey = await getOrgActiveAiKey(supabase);
    if (orgKey) return orgKey;

    await notifyAdminsMissingIntegratedAiKey(supabase, userId);
    throw new Error(
      "A IA integrada do seu plano ainda não está disponível: o administrador não configurou a chave de IA. O administrador já foi notificado."
    );
  }

  const userKey = await getUserActiveAiKey(userId, supabase);
  if (userKey) return userKey;

  throw new Error(
    "Configuração de IA não encontrada. O seu plano não inclui IA integrada — configure a sua própria chave em Definições > IA."
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

  // Mesma regra por plano da resolveAiKey: com IA integrada só a chave do
  // admin; caso contrário só a do consultor (sem misturar).
  const aiIncluded = await isAiIncludedForUser(userId, supabase);

  if (aiIncluded) {
    const orgKey = await getOrgActiveAiKey(supabase);
    return orgKey && orgKey.provider === provider ? orgKey : null;
  }

  const { data: userKey } = await supabase
    .from("gpt_api_keys")
    .select("provider, model, api_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userKey) return { provider: userKey.provider, model: userKey.model, apiKey: userKey.api_key, scope: "user" };

  return null;
}
