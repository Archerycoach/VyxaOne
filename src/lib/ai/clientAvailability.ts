import { supabase } from "@/integrations/supabase/client";

/**
 * Determina, no cliente, se o utilizador atual tem IA disponível para gates de
 * UI (ex.: página do Agente IA). Devolve true se:
 *  - tem uma chave pessoal em gpt_api_keys, OU
 *  - está num plano de subscrição com IA integrada (ai_included) — nesse caso a
 *    chave usada é a da agência, resolvida SEMPRE no servidor (nunca exposta ao
 *    browser). Ver lib/ai/keys.ts.
 *
 * Não deixa de bloquear por a chave da agência poder ainda não estar
 * configurada: nesse caso o utilizador deve poder tentar e receber o erro
 * claro do servidor (que também notifica o admin), em vez de um bloqueio mudo.
 */
export async function isAiAvailableForCurrentUser(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // 1) Chave pessoal do consultor.
  const { data: keys } = await (supabase
    .from("gpt_api_keys" as any)
    .select("id")
    .eq("user_id", user.id)
    .limit(1) as any);
  if (keys && keys.length > 0) return true;

  // 2) Plano com IA integrada. Determinamos o plano pelo PERFIL (que o próprio
  //    utilizador lê sempre e é mantido em sincronia pelos fluxos de admin),
  //    evitando depender do RLS da tabela subscriptions no cliente.
  const { data: prof } = await supabase
    .from("profiles")
    .select("subscription_plan")
    .eq("id", user.id)
    .maybeSingle();

  let planId: string | null = (prof as any)?.subscription_plan || null;

  // Fallback: se o perfil não tiver o plano, tenta a subscrição ativa.
  if (!planId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    planId = sub?.plan_id || null;
  }

  if (!planId) return false;

  const { data: plan } = await (supabase
    .from("subscription_plans")
    .select("ai_included")
    .eq("id", planId)
    .maybeSingle() as any);

  return !!plan?.ai_included;
}
