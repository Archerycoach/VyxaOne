import { supabase } from "@/integrations/supabase/client";

/**
 * Base de Conhecimento — acesso do lado do cliente.
 *
 * Tudo passa por `/api/knowledge/*` com o token do utilizador: os endpoints
 * usam service-role e limitam ao próprio, porque a leitura direta por RLS já
 * mostrou dar listas vazias quando falta uma policy na base viva.
 */

export type KnowledgeScope = "user" | "agency";
export type KnowledgeStatus = "pending" | "indexed" | "failed";

export interface KnowledgeDoc {
  id: string;
  user_id: string;
  scope: KnowledgeScope;
  title: string;
  source: "text" | "upload";
  file_name: string | null;
  mime_type: string | null;
  char_count: number;
  status: KnowledgeStatus;
  error: string | null;
  chunk_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeMatch {
  doc_id: string;
  title: string;
  scope: KnowledgeScope;
  content: string;
  similarity: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function unwrap(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Ocorreu um erro.");
  return body;
}

export async function getKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const res = await fetch("/api/knowledge", { headers: await authHeaders() });
  const body = await unwrap(res);
  return (body.docs || []) as KnowledgeDoc[];
}

export async function createKnowledgeDoc(params: {
  title: string;
  scope: KnowledgeScope;
  text?: string;
  fileBase64?: string;
  fileName?: string;
  mimeType?: string;
  tags?: string[];
}): Promise<{ id: string; status: KnowledgeStatus; chunkCount?: number; error?: string }> {
  const res = await fetch("/api/knowledge", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  return unwrap(res);
}

export async function updateKnowledgeDoc(
  id: string,
  patch: { title?: string; scope?: KnowledgeScope; tags?: string[] }
): Promise<void> {
  const res = await fetch(`/api/knowledge/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  await unwrap(res);
}

export async function reindexKnowledgeDoc(id: string): Promise<{ chunkCount: number }> {
  const res = await fetch(`/api/knowledge/${id}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return unwrap(res);
}

export async function deleteKnowledgeDoc(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await unwrap(res);
}

export async function searchKnowledgeDocs(query: string): Promise<KnowledgeMatch[]> {
  const res = await fetch("/api/knowledge/search", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ query }),
  });
  const body = await unwrap(res);
  return (body.matches || []) as KnowledgeMatch[];
}

/** Lê um ficheiro do disco como data URL base64, para enviar no corpo do POST. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}
