import { supabase } from "@/integrations/supabase/client";

/** Pesquisa semântica de imóveis e indexação da carteira. */

export interface SemanticPropertyResult {
  id: string;
  title: string;
  property_type?: string | null;
  typology?: string | null;
  city?: string | null;
  district?: string | null;
  price?: number | null;
  area?: number | null;
  bedrooms?: number | null;
  status?: string | null;
  /** 0–100: quão bem o imóvel corresponde à procura. */
  similarity: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Volta a entrar.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function searchPropertiesSemantic(params: {
  query?: string;
  leadId?: string;
  limit?: number;
}): Promise<{ matches: SemanticPropertyResult[]; leadName?: string | null; hint?: string }> {
  const headers = await authHeaders();
  const response = await fetch("/api/gpt/properties/semantic-search", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro na pesquisa.");
  return data;
}

/** Indexa um imóvel (depois de criar/editar). Best-effort: nunca bloqueia o fluxo. */
export async function indexPropertyForSearch(propertyId: string): Promise<void> {
  try {
    const headers = await authHeaders();
    await fetch("/api/gpt/properties/index-embeddings", {
      method: "POST",
      headers,
      body: JSON.stringify({ propertyId }),
    });
  } catch (error) {
    console.error("[semanticSearch] Falha ao indexar imóvel:", error);
  }
}

/** Indexa toda a carteira (backfill inicial). */
export async function indexAllProperties(): Promise<{
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
}> {
  const headers = await authHeaders();
  const response = await fetch("/api/gpt/properties/index-embeddings", {
    method: "POST",
    headers,
    body: JSON.stringify({ all: true }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro ao indexar.");
  return data;
}
