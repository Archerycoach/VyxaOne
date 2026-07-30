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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  const res = await fetch(`/api/inbox-assistant/items?includeHandled=${includeHandled}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    console.error("[inboxAssistant] Erro ao listar:", await res.text().catch(() => ""));
    return [];
  }
  const body = await res.json().catch(() => ({ items: [] }));
  return (body.items || []) as InboxTriageItem[];
}

export async function setTriageStatus(
  id: string,
  status: "new" | "handled" | "dismissed"
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");

  const res = await fetch("/api/inbox-assistant/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Falha ao atualizar o lembrete.");
  }
}

export interface RunNowResult {
  success: boolean;
  scanned: number;
  flagged: number;
  message: string;
}

/** Corre o assistente na hora para o próprio consultor (diagnóstico + uso). */
export async function runInboxNow(): Promise<RunNowResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");

  const res = await fetch("/api/inbox-assistant/run-now", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Falha ao verificar a caixa.");
  return {
    success: !!body.success,
    scanned: body.scanned ?? 0,
    flagged: body.flagged ?? 0,
    message: body.message || "",
  };
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
