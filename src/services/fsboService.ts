import { supabase } from "@/integrations/supabase/client";

/**
 * Assistente FSBO — caderno de angariação do consultor.
 *
 * A aplicação nunca contacta o proprietário: só organiza a informação que o
 * consultor recolheu e cruza-a com a carteira de compradores dele.
 */

export type FsboStatus = "novo" | "contactado" | "sem_interesse" | "angariado" | "descartado";

export interface FsboProspect {
  id: string;
  user_id: string;
  source_url: string | null;
  source: string | null;
  title: string | null;
  description: string | null;
  property_type: string | null;
  typology: string | null;
  price: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
  energy_rating: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  status: FsboStatus;
  notes: string | null;
  contacted_at: string | null;
  matched_buyers: number;
  created_at: string;
  updated_at: string;
}

export interface FsboBuyerMatch {
  leadId: string;
  name: string;
  phone: string | null;
  email: string | null;
  temperature: string | null;
  score: number;
  reasons: string[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Volta a entrar.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface FsboSearchResult {
  propertyCode: string;
  url: string;
  thumbnail: string | null;
  title: string;
  description: string;
  price: number | null;
  size: number | null;
  rooms: number | null;
  bathrooms: number | null;
  municipality: string | null;
  district: string | null;
  typology: string | null;
  propertyType: string | null;
  alreadySaved: boolean;
  buyerMatches: Array<{ leadId: string; name: string; score: number }>;
  buyerMatchCount: number;
}

export interface FsboSearchParams {
  center: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: string;
  propertyType?: string;
  distance?: number;
}

/** Procura particulares a vender no Idealista, cruzados com a carteira. */
export async function searchFsboListings(params: FsboSearchParams): Promise<{
  totalFound: number;
  privateCount: number;
  buyersConsidered: number;
  results: FsboSearchResult[];
}> {
  const headers = await authHeaders();
  const response = await fetch("/api/gpt/fsbo/search", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro na pesquisa.");
  return data;
}

/** Organiza o texto de um anúncio nos campos do imóvel. Não grava. */
export async function extractFsboListing(params: { text: string; sourceUrl?: string }): Promise<{
  prospect: Partial<FsboProspect>;
  isPrivateSeller: boolean;
  agencySignals: string | null;
}> {
  const headers = await authHeaders();
  const response = await fetch("/api/gpt/fsbo/extract", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro ao organizar o anúncio.");
  return data;
}

/** Cruza com a carteira de compradores. */
export async function matchFsboBuyers(params: {
  prospectId?: string;
  prospect?: Partial<FsboProspect>;
  minScore?: number;
}): Promise<{ total: number; buyersConsidered: number; matches: FsboBuyerMatch[] }> {
  const headers = await authHeaders();
  const response = await fetch("/api/gpt/fsbo/match", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro ao cruzar com a carteira.");
  return data;
}

export async function listFsboProspects(status?: FsboStatus | "todos"): Promise<FsboProspect[]> {
  let query = supabase
    .from("fsbo_prospects" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "todos") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as FsboProspect[];
}

export async function saveFsboProspect(prospect: Partial<FsboProspect>): Promise<FsboProspect> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");

  const { data, error } = await supabase
    .from("fsbo_prospects" as any)
    .insert({ ...prospect, user_id: user.id } as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as FsboProspect;
}

export async function updateFsboProspect(
  id: string,
  updates: Partial<FsboProspect>
): Promise<void> {
  const { error } = await supabase
    .from("fsbo_prospects" as any)
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteFsboProspect(id: string): Promise<void> {
  const { error } = await supabase.from("fsbo_prospects" as any).delete().eq("id", id);
  if (error) throw error;
}
