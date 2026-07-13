import { supabase } from "@/integrations/supabase/client";

// Gestão dos itens mostrados no Portal do Cliente de uma lead: imóveis do CRM
// (property_matches) e links externos (portal_external_listings). A adição
// passa por um endpoint server-side que também alerta o cliente por email.

export interface PortalMatch {
  id: string;
  property_id: string;
  match_score: number | null;
  match_reasons: string[] | null;
  property: {
    id: string;
    title: string;
    city: string | null;
    price: number | null;
    main_image_url: string | null;
    reference_code: string | null;
  } | null;
}

export interface PortalExternalListing {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  price: number | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

// Imóveis (do CRM) atualmente no portal desta lead.
export async function getPortalMatches(leadId: string): Promise<PortalMatch[]> {
  const { data, error } = await (supabase.from("property_matches") as any)
    .select("id, property_id, match_score, match_reasons, property:properties(id, title, city, price, main_image_url, reference_code)")
    .eq("lead_id", leadId)
    .order("match_score", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as PortalMatch[];
}

// Links externos atualmente no portal desta lead.
export async function getPortalExternal(leadId: string): Promise<PortalExternalListing[]> {
  const { data, error } = await (supabase.from("portal_external_listings" as any) as any)
    .select("id, title, url, image_url, price")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as PortalExternalListing[];
}

// Adiciona um imóvel do CRM (via endpoint — também alerta o cliente por email).
export async function addPortalProperty(leadId: string, propertyId: string): Promise<void> {
  const res = await fetch("/api/portal/add-item", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ leadId, kind: "property", propertyId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao adicionar imóvel");
}

// Adiciona um link externo (via endpoint — também alerta o cliente por email).
export async function addPortalExternal(
  leadId: string,
  external: { title: string; url: string; image_url?: string; price?: number | null }
): Promise<void> {
  const res = await fetch("/api/portal/add-item", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ leadId, kind: "external", external }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao adicionar link");
}

export async function removePortalMatch(matchId: string): Promise<void> {
  const { error } = await (supabase.from("property_matches") as any).delete().eq("id", matchId);
  if (error) throw error;
}

export async function removePortalExternal(id: string): Promise<void> {
  const { error } = await (supabase.from("portal_external_listings" as any) as any).delete().eq("id", id);
  if (error) throw error;
}
