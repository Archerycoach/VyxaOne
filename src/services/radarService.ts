import { supabase } from "@/integrations/supabase/client";

export type RadarEntityType = "lead" | "contact";
export type RadarResolveReason = "won" | "lost" | "not_interested" | "other";

export interface RadarItem {
  id: string;
  user_id: string;
  entity_type: RadarEntityType;
  entity_id: string;
  cadence_days: number;
  note: string | null;
  last_activity_at: string;
  last_nudge_at: string | null;
  snooze_until: string | null;
  resolved_at: string | null;
  resolved_reason: RadarResolveReason | null;
  created_at: string;
}

export type RadarState = "overdue" | "soon" | "ok" | "snoozed";

export interface RadarItemEnriched extends RadarItem {
  name: string;
  temperature: string | null;
  daysSinceActivity: number;
  state: RadarState;
}

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Default de cadência (dias) configurado em system_settings; 3 se não existir. */
export async function getRadarDefaultCadence(): Promise<number> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "radar_default_cadence_days")
      .maybeSingle();
    const raw = (data as any)?.value;
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "").replace(/"/g, ""), 10);
    return Number.isFinite(n) && n >= 1 ? n : 3;
  } catch {
    return 3;
  }
}

/** Item de radar ativo do utilizador atual para uma entidade, ou null. */
export async function getRadarItemFor(
  entityType: RadarEntityType,
  entityId: string
): Promise<RadarItem | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await (supabase
    .from("radar_items" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("resolved_at", null)
    .maybeSingle() as any);
  return (data as RadarItem) || null;
}

export async function addToRadar(params: {
  entityType: RadarEntityType;
  entityId: string;
  cadenceDays: number;
  note?: string;
}): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Sem sessão");
  const { error } = await (supabase.from("radar_items" as any) as any).insert({
    user_id: userId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    cadence_days: params.cadenceDays,
    note: params.note || null,
    last_activity_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function resolveRadarItem(id: string, reason: RadarResolveReason): Promise<void> {
  const { error } = await (supabase.from("radar_items" as any) as any)
    .update({ resolved_at: new Date().toISOString(), resolved_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function snoozeRadarItem(id: string, days: number): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  const { error } = await (supabase.from("radar_items" as any) as any)
    .update({ snooze_until: until.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** "Registar contacto": repõe o relógio de inatividade e limpa o snooze. */
export async function registerRadarContact(id: string): Promise<void> {
  const { error } = await (supabase.from("radar_items" as any) as any)
    .update({ last_activity_at: new Date().toISOString(), snooze_until: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

function computeState(item: RadarItem, now: number): RadarState {
  if (item.snooze_until && new Date(item.snooze_until).getTime() > now) return "snoozed";
  const days = Math.floor((now - new Date(item.last_activity_at).getTime()) / 86400000);
  if (days >= item.cadence_days) return "overdue";
  if (days >= item.cadence_days - 1) return "soon";
  return "ok";
}

/** Itens ativos do utilizador atual, enriquecidos com nome/temperatura e ordenados
 *  pelos mais "parados" primeiro. */
export async function getRadarItems(): Promise<RadarItemEnriched[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data: itemsRaw } = await (supabase
    .from("radar_items" as any)
    .select("*")
    .eq("user_id", userId)
    .is("resolved_at", null) as any);

  const items = (itemsRaw as RadarItem[]) || [];
  if (items.length === 0) return [];

  const leadIds = items.filter((i) => i.entity_type === "lead").map((i) => i.entity_id);
  const contactIds = items.filter((i) => i.entity_type === "contact").map((i) => i.entity_id);

  const leadMap = new Map<string, any>();
  if (leadIds.length) {
    const { data } = await supabase.from("leads").select("id, name, temperature").in("id", leadIds);
    (data || []).forEach((l: any) => leadMap.set(l.id, l));
  }
  const contactMap = new Map<string, any>();
  if (contactIds.length) {
    const { data } = await supabase.from("contacts").select("id, name").in("id", contactIds);
    (data || []).forEach((c: any) => contactMap.set(c.id, c));
  }

  const now = Date.now();
  const enriched: RadarItemEnriched[] = items.map((i) => {
    const ent = i.entity_type === "lead" ? leadMap.get(i.entity_id) : contactMap.get(i.entity_id);
    const daysSinceActivity = Math.floor((now - new Date(i.last_activity_at).getTime()) / 86400000);
    return {
      ...i,
      name: ent?.name || "(sem nome)",
      temperature: ent?.temperature ?? null,
      daysSinceActivity,
      state: computeState(i, now),
    };
  });

  const rank: Record<RadarState, number> = { overdue: 0, soon: 1, ok: 2, snoozed: 3 };
  return enriched.sort((a, b) =>
    rank[a.state] !== rank[b.state] ? rank[a.state] - rank[b.state] : b.daysSinceActivity - a.daysSinceActivity
  );
}

/** Resumo para o widget do Dashboard. */
export async function getRadarSummary(): Promise<{ total: number; overdue: number; topOverdue: RadarItemEnriched[] }> {
  const items = await getRadarItems();
  const overdue = items.filter((i) => i.state === "overdue");
  return { total: items.length, overdue: overdue.length, topOverdue: overdue.slice(0, 3) };
}
