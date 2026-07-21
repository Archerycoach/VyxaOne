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

  // Contagens exatas em vez de trazer as linhas e contá-las no cliente.
  //
  // O Supabase devolve no máximo 1000 linhas por pedido, por isso a versão
  // anterior — que trazia as interações todas e as somava aqui — parava de
  // crescer assim que a atividade do período passava as 1000 ações. Era o
  // motivo de os emails enviados em massa nunca aparecerem no total.
  const countInteractions = async (types: string[]) => {
    const { count, error } = await supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("interaction_type", types)
      .gte("interaction_date", range.from)
      .lte("interaction_date", range.to);
    if (error) {
      console.error("[activityMetrics] Erro a contar interações:", error);
      return 0;
    }
    return count ?? 0;
  };

  // Eventos de agenda: contam como realizados (exclui no-show).
  const countEvents = async (types: string[]) => {
    const { count, error } = await supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("event_type", types)
      .is("no_show_at", null)
      .gte("start_time", range.from)
      .lte("start_time", range.to);
    if (error) {
      console.error("[activityMetrics] Erro a contar eventos:", error);
      return 0;
    }
    return count ?? 0;
  };

  const [
    callInteractions, emails, whatsapp, meetingInteractions, visitInteractions, notes,
    callEvents, meetingEvents, visitEvents,
  ] = await Promise.all([
    countInteractions(["call"]),
    countInteractions(["email"]),
    countInteractions(["whatsapp", "whatsapp_outbound"]),
    countInteractions(["meeting"]),
    countInteractions(["visit"]),
    countInteractions(["note"]),
    countEvents(["call"]),
    countEvents(["meeting"]),
    countEvents(["viewing", "visit"]),
  ]);

  const counts: ActivityCounts = {
    ...EMPTY,
    calls: callInteractions + callEvents,
    emails,
    whatsapp,
    meetings: meetingInteractions + meetingEvents,
    visits: visitInteractions + visitEvents,
    notes,
  };

  counts.total = counts.calls + counts.emails + counts.whatsapp + counts.meetings + counts.visits + counts.notes;
  return counts;
}
