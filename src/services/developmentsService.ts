import { supabase } from "@/integrations/supabase/client";
import type { Development, DevelopmentStatus } from "@/types";

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
  return mapDevelopment(data as DevelopmentRow);
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