import { supabase } from "@/integrations/supabase/client";

export type LandingEntityType = "property" | "development";

const TABLE: Record<LandingEntityType, string> = {
  property: "properties",
  development: "developments",
};

// Token aleatório não previsível (usado na landing pessoal e como sufixo).
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sufixo curto aleatório (6 chars) para garantir unicidade do slug.
function shortSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Transforma um texto num slug legível para URL: minúsculas, sem acentos,
// só letras/números/hífens. Ex: "Moradia T3 - Alcochete" -> "moradia-t3-alcochete".
function slugify(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "pagina";
}

// Gera um token/slug atrativo a partir de um nome + sufixo curto único.
function buildSlug(name: string): string {
  return `${slugify(name)}-${shortSuffix()}`;
}

// Gera (uma vez) e devolve o URL da landing page, com um slug legível a partir
// do título/nome. Não publica — só cria o link.
export async function getOrCreateLandingLink(entityType: LandingEntityType, id: string): Promise<string> {
  const nameField = entityType === "property" ? "title" : "name";
  const { data, error } = await supabase
    .from(TABLE[entityType] as any)
    .select(`landing_token, ${nameField}`)
    .eq("id", id)
    .single();
  if (error) throw error;

  let token = (data as any)?.landing_token as string | null;
  if (!token) {
    const baseName = (data as any)?.[nameField] || "imovel";
    // Tenta gravar um slug único (o sufixo aleatório torna colisões improváveis;
    // ainda assim, repete-se em caso de conflito com a constraint UNIQUE).
    for (let attempt = 0; attempt < 4 && !token; attempt++) {
      const candidate = buildSlug(baseName);
      const { error: updErr } = await supabase
        .from(TABLE[entityType] as any)
        .update({ landing_token: candidate } as any)
        .eq("id", id);
      if (!updErr) { token = candidate; break; }
      if (!String(updErr.message || "").toLowerCase().includes("duplicate")) throw updErr;
    }
    if (!token) token = generateSecureToken(); // fallback improvável
  }
  return `${window.location.origin}/l/${token}`;
}

// Liga/desliga a visibilidade pública da landing page.
export async function setLandingPublished(entityType: LandingEntityType, id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from(TABLE[entityType] as any)
    .update({ landing_published: published } as any)
    .eq("id", id);
  if (error) throw error;
}

// ---- Landing page pessoal do consultor (tabela profiles) ----

export interface PersonalLandingState {
  token: string | null;
  published: boolean;
  headline: string;
  bio: string;
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user.id;
}

export async function getPersonalLanding(): Promise<PersonalLandingState> {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("landing_token, landing_published, landing_headline, landing_bio")
    .eq("id", id)
    .single();
  if (error) throw error;
  const p = data as any;
  return {
    token: p?.landing_token ?? null,
    published: !!p?.landing_published,
    headline: p?.landing_headline ?? "",
    bio: p?.landing_bio ?? "",
  };
}

export async function savePersonalLanding(fields: { headline: string; bio: string }): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ landing_headline: fields.headline, landing_bio: fields.bio } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function setPersonalLandingPublished(published: boolean): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ landing_published: published } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function getOrCreatePersonalLandingLink(): Promise<string> {
  const id = await currentUserId();
  const { data, error } = await supabase.from("profiles").select("landing_token, full_name").eq("id", id).single();
  if (error) throw error;
  let token = (data as any)?.landing_token as string | null;
  if (!token) {
    const baseName = (data as any)?.full_name || "consultor";
    for (let attempt = 0; attempt < 4 && !token; attempt++) {
      const candidate = buildSlug(baseName);
      const { error: updErr } = await supabase.from("profiles").update({ landing_token: candidate } as any).eq("id", id);
      if (!updErr) { token = candidate; break; }
      if (!String(updErr.message || "").toLowerCase().includes("duplicate")) throw updErr;
    }
    if (!token) token = generateSecureToken();
  }
  return `${window.location.origin}/consultor/${token}`;
}

export async function getLandingState(entityType: LandingEntityType, id: string): Promise<{ token: string | null; published: boolean }> {
  const { data, error } = await supabase
    .from(TABLE[entityType] as any)
    .select("landing_token, landing_published")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    token: (data as any)?.landing_token ?? null,
    published: !!(data as any)?.landing_published,
  };
}
