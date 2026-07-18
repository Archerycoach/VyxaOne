import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente da caixa de entrada do assistente de IA.
 * Toda a decisão passa pelo servidor, que revalida a propriedade das ações.
 */

export interface AiActionItem {
  id: string;
  capability: string;
  status: "pending" | "approved" | "rejected" | "auto_applied" | "failed" | "reverted";
  entity_type: string;
  entity_id: string | null;
  lead_id: string | null;
  title: string;
  reason: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  previous_state: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
  applied_at: string | null;
  reverted_at: string | null;
  leads?: { name: string } | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sessão expirada. Volta a entrar.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function getAiActions(scope: "pending" | "history"): Promise<AiActionItem[]> {
  const headers = await authHeaders();
  const response = await fetch(`/api/ai-actions?status=${scope}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Não foi possível carregar as ações da IA.");
  }
  const data = await response.json();
  return data.actions || [];
}

export async function decideAiActions(
  ids: string[],
  decision: "approve" | "reject" | "revert"
): Promise<{ succeeded: number; total: number }> {
  const headers = await authHeaders();
  const response = await fetch("/api/ai-actions/decide", {
    method: "POST",
    headers,
    body: JSON.stringify({ ids, decision }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Não foi possível concluir a operação.");
  }
  return response.json();
}
