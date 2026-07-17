import { supabase } from "@/integrations/supabase/client";

/**
 * Métricas de atividade do consultor — calculadas AO VIVO a partir dos dados
 * que já são registados (tabela `interactions`) mais a agenda
 * (`calendar_events`), sem tabela nova nem duplicação.
 *
 * "Visita" e "reunião" contam AMBAS as fontes (interações registadas + eventos
 * de agenda), por decisão do produto — dá a visão mais completa do trabalho de
 * campo. Pode haver ligeira sobreposição se o consultor registar a mesma visita
 * nas duas (interação + evento); é aceitável para um indicador de atividade.
 */

export type ActivityPeriodKey = "7" | "30" | "90" | "month" | "custom";

export interface ActivityRange {
  from: string; // ISO
  to: string; // ISO
}

export interface ActivityCounts {
  calls: number;
  emails: number;
  whatsapp: number;
  meetings: number;
  visits: number;
  notes: number;
  total: number;
}

/** Resolve um período (preset ou custom) num intervalo [from, to] ISO. */
export function resolveActivityRange(
  key: ActivityPeriodKey,
  customFrom?: string,
  customTo?: string
): ActivityRange {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (key === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const t = new Date(customTo);
    t.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: t.toISOString() };
  }

  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const days = parseInt(key, 10) || 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

const EMPTY: ActivityCounts = { calls: 0, emails: 0, whatsapp: 0, meetings: 0, visits: 0, notes: 0, total: 0 };

/**
 * Conta a atividade de um consultor (ou do próprio, se agentId não for dado)
 * num intervalo de datas. Respeita o RLS: um consultor só vê a sua atividade;
 * um gestor vê a do agente pedido dentro do seu âmbito.
 */
export async function getActivityMetrics(range: ActivityRange, agentId?: string): Promise<ActivityCounts> {
  let uid = agentId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...EMPTY };
    uid = user.id;
  }

  const [interactionsRes, eventsRes] = await Promise.all([
    supabase
      .from("interactions")
      .select("interaction_type")
      .eq("user_id", uid)
      .gte("interaction_date", range.from)
      .lte("interaction_date", range.to),
    supabase
      .from("calendar_events")
      .select("event_type, no_show_at")
      .eq("user_id", uid)
      .gte("start_time", range.from)
      .lte("start_time", range.to),
  ]);

  const counts: ActivityCounts = { ...EMPTY };

  for (const row of (interactionsRes.data || []) as { interaction_type: string | null }[]) {
    const t = (row.interaction_type || "").toLowerCase();
    if (t === "call") counts.calls++;
    else if (t === "email") counts.emails++;
    else if (t === "whatsapp" || t === "whatsapp_outbound") counts.whatsapp++;
    else if (t === "meeting") counts.meetings++;
    else if (t === "visit") counts.visits++;
    else if (t === "note") counts.notes++;
  }

  // Eventos de agenda: contam como reuniões/visitas realizadas (exclui no-show).
  for (const row of (eventsRes.data || []) as { event_type: string | null; no_show_at: string | null }[]) {
    if (row.no_show_at) continue;
    const t = (row.event_type || "").toLowerCase();
    if (t === "meeting") counts.meetings++;
    else if (t === "viewing" || t === "visit") counts.visits++;
    else if (t === "call") counts.calls++;
  }

  counts.total = counts.calls + counts.emails + counts.whatsapp + counts.meetings + counts.visits + counts.notes;
  return counts;
}
