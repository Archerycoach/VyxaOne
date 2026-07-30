import { supabase } from "@/integrations/supabase/client";

export interface InboxTriageItem {
  id: string;
  from_name: string | null;
  importance: "high" | "medium" | "low";
  reminder: string | null;
  advice: string | null;
  agenda_suggestion: string | null;
  lead_id: string | null;
  status: "new" | "handled" | "dismissed";
  created_at: string | null;
}

/** Emails sinalizados pelo assistente, mais importantes primeiro. */
export async function getInboxTriage(includeHandled = false): Promise<InboxTriageItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("inbox_triage" as any)
    .select("*")
    .eq("user_id", user.id);

  if (!includeHandled) query = query.eq("status", "new");

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[inboxAssistant] Erro ao listar:", error);
    return [];
  }

  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return ((data || []) as unknown as InboxTriageItem[]).sort(
    (a, b) => (rank[a.importance] ?? 1) - (rank[b.importance] ?? 1)
  );
}

export async function setTriageStatus(
  id: string,
  status: "new" | "handled" | "dismissed"
): Promise<void> {
  const { error } = await supabase.from("inbox_triage" as any).update({ status }).eq("id", id);
  if (error) throw error;
}

/** Endereços/domínios que o consultor pediu para ignorar sempre. */
export async function getIgnoreSenders(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await (supabase
    .from("user_smtp_settings" as any)
    .select("email_ignore_senders")
    .eq("user_id", user.id)
    .maybeSingle());
  return ((data as any)?.email_ignore_senders as string[]) || [];
}

export async function setIgnoreSenders(list: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const clean = Array.from(
    new Set(list.map((s) => s.toLowerCase().trim()).filter(Boolean))
  );
  const { error } = await (supabase
    .from("user_smtp_settings" as any)
    .update({ email_ignore_senders: clean })
    .eq("user_id", user.id));
  if (error) throw error;
}
