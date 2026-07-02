import { supabase } from "@/integrations/supabase/client";

export interface MessageSnippet {
  id: string;
  user_id: string;
  title: string;
  content: string;
  channel: "email" | "whatsapp" | "both";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MessageSnippetInput {
  title: string;
  content: string;
  channel: "email" | "whatsapp" | "both";
}

export interface SnippetPersonalizationContext {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  development_name?: string | null;
}

/**
 * Substitui as variáveis suportadas por uma resposta rápida. Mesma lista de
 * variáveis usada nas automações (ver personalizeContent em
 * src/lib/server/workflowEngine.ts), para o consultor não ter de aprender
 * uma sintaxe diferente consoante o sítio onde escreve o texto.
 */
export function personalizeSnippet(content: string, lead: SnippetPersonalizationContext): string {
  return content
    .replace(/\{nome\}/g, lead.name || "")
    .replace(/\{email\}/g, lead.email || "")
    .replace(/\{telefone\}/g, lead.phone || "")
    .replace(/\{empreendimento\}/g, lead.development_name || "");
}

// NOTA: "message_snippets" só existe depois de correr a migração
// supabase/migrations/20260702110000_*.sql e regenerar database.types.ts —
// até lá usamos "as any" no nome da tabela, o mesmo padrão já usado no resto
// do código para tabelas recentes (ex.: user_smtp_settings em
// smtpService.ts). Pode ser removido assim que os tipos forem regenerados.

export async function getMessageSnippets(channel?: "email" | "whatsapp"): Promise<MessageSnippet[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = (supabase
    .from("message_snippets" as any)
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true }) as any);

  if (channel) {
    query = query.in("channel", [channel, "both"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as MessageSnippet[];
}

export async function createMessageSnippet(input: MessageSnippetInput): Promise<MessageSnippet> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await (supabase
    .from("message_snippets" as any)
    .insert({ ...input, user_id: user.id })
    .select()
    .single() as any);

  if (error) throw error;
  return data as MessageSnippet;
}

export async function updateMessageSnippet(id: string, input: Partial<MessageSnippetInput>): Promise<MessageSnippet> {
  const { data, error } = await (supabase
    .from("message_snippets" as any)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single() as any);

  if (error) throw error;
  return data as MessageSnippet;
}

export async function deleteMessageSnippet(id: string): Promise<void> {
  const { error } = await (supabase.from("message_snippets" as any).delete().eq("id", id) as any);
  if (error) throw error;
}
