import { supabase } from "@/integrations/supabase/client";
import type { Development, DevelopmentStatus, DevelopmentTypology } from "@/types";
import { matchNewDevelopment } from "./contactAlertsService";

export interface DevelopmentInsert {
  user_id: string;
  name: string;
  description?: string | null;
  status?: DevelopmentStatus;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  postal_code?: string | null;
  developer_name?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  typologies?: string[] | null;
  total_units?: number | null;
  available_units?: number | null;
  delivery_date?: string | null;
  published_at?: string | null;
  highlights?: string[] | null;
  images?: string[] | null;
  main_image_url?: string | null;
  reference_code?: string | null;
  payment_terms?: string | null;
  reservation_terms?: string | null;
  amenities?: string[] | null;
}

/** Linha de tipologia editável no formulário (sem ids — geridas por save). */
export interface DevelopmentTypologyInput {
  typology: string;
  price_from?: number | null;
  price_to?: number | null;
  area_from?: number | null;
  area_to?: number | null;
  units_total?: number | null;
  units_available?: number | null;
}

export type DevelopmentUpdate = Partial<DevelopmentInsert>;

type DevelopmentRow = Development;

type UntypedSupabaseClient = {
  from: (relation: string) => any;
};

const untypedSupabase = supabase as unknown as UntypedSupabaseClient;

function fromDevelopments() {
  return untypedSupabase.from("developments");
}

function mapDevelopment(row: DevelopmentRow): Development {
  return row;
}

export async function getDevelopments(): Promise<Development[]> {
  const { data, error } = await fromDevelopments()
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as DevelopmentRow[]).map(mapDevelopment);
}

export async function createDevelopment(payload: DevelopmentInsert): Promise<Development> {
  const { data, error } = await fromDevelopments()
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  
  const development = mapDevelopment(data as DevelopmentRow);
  
  // Asynchronously match new development against active contact alerts
  matchNewDevelopment(development).catch(console.error);
  
  return development;
}

export async function updateDevelopment(id: string, updates: DevelopmentUpdate): Promise<Development> {
  const payload: DevelopmentUpdate = {
    ...updates,
  };

  const { data, error } = await fromDevelopments()
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapDevelopment(data as DevelopmentRow);
}

export async function deleteDevelopment(id: string): Promise<void> {
  const { error } = await fromDevelopments()
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================================
// Tipologias por empreendimento (development_typologies)
// ============================================================

export async function getDevelopmentTypologies(developmentId: string): Promise<DevelopmentTypology[]> {
  const { data, error } = await untypedSupabase
    .from("development_typologies")
    .select("*")
    .eq("development_id", developmentId)
    .order("typology", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DevelopmentTypology[];
}

/** Tipologias de vários empreendimentos de uma vez (para a lista/cards). */
/**
 * Quantas leads estão associadas a cada empreendimento.
 *
 * Uma query só para todos os cartões, em vez de uma por empreendimento.
 * O RLS garante que cada consultor só conta as leads que pode ver.
 */
export async function getLeadCountsByDevelopment(): Promise<Record<string, number>> {
  const { data, error } = await untypedSupabase
    .from("leads")
    .select("development_id")
    .not("development_id", "is", null)
    .is("archived_at", null);

  if (error) {
    console.error("[developmentsService] Erro ao contar leads por empreendimento:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ development_id: string }>) {
    counts[row.development_id] = (counts[row.development_id] || 0) + 1;
  }
  return counts;
}

export async function getTypologiesByDevelopment(): Promise<Record<string, DevelopmentTypology[]>> {
  const { data, error } = await untypedSupabase
    .from("development_typologies")
    .select("*")
    .order("typology", { ascending: true });

  if (error) throw error;

  const grouped: Record<string, DevelopmentTypology[]> = {};
  for (const row of (data ?? []) as DevelopmentTypology[]) {
    (grouped[row.development_id] ||= []).push(row);
  }
  return grouped;
}

/**
 * Substitui as linhas de tipologia de um empreendimento (delete + insert —
 * simples e suficiente para o volume em causa).
 */
export async function saveDevelopmentTypologies(
  developmentId: string,
  userId: string,
  rows: DevelopmentTypologyInput[]
): Promise<void> {
  const { error: deleteError } = await untypedSupabase
    .from("development_typologies")
    .delete()
    .eq("development_id", developmentId);

  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const { error: insertError } = await untypedSupabase
    .from("development_typologies")
    .insert(rows.map((row) => ({
      development_id: developmentId,
      user_id: userId,
      typology: row.typology,
      price_from: row.price_from ?? null,
      price_to: row.price_to ?? null,
      area_from: row.area_from ?? null,
      area_to: row.area_to ?? null,
      units_total: row.units_total ?? null,
      units_available: row.units_available ?? null,
    })));

  if (insertError) throw insertError;
}

/**
 * Deriva os campos "globais" retrocompatíveis (typologies[], price_from/to)
 * a partir das linhas de tipologia — o resto da app (cards, contact alerts)
 * continua a funcionar sem alterações.
 */
export function deriveGlobalsFromTypologies(rows: DevelopmentTypologyInput[]): {
  typologies: string[] | null;
  price_from: number | null;
  price_to: number | null;
} {
  if (rows.length === 0) {
    return { typologies: null, price_from: null, price_to: null };
  }

  const prices_from = rows.map((r) => r.price_from).filter((v): v is number => v != null);
  const prices_to = rows.map((r) => r.price_to).filter((v): v is number => v != null);

  return {
    typologies: rows.map((r) => r.typology),
    price_from: prices_from.length > 0 ? Math.min(...prices_from) : null,
    price_to: prices_to.length > 0 ? Math.max(...prices_to) : null,
  };
}

export async function getRecentDevelopments(days = 30): Promise<Development[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await fromDevelopments()
    .select("*")
    .gte("published_at", cutoff.toISOString())
    .order("published_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as DevelopmentRow[]).map(mapDevelopment);
}