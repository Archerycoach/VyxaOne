import { supabase } from "@/integrations/supabase/client";

/**
 * Gera um token aleatório e seguro (32 bytes, hex) usando a Web Crypto API
 * já disponível no browser — não previsível, adequado para um link público.
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Devolve o URL completo do Portal do Cliente para uma lead — gera e grava
 * um novo token na primeira vez que for pedido; nas vezes seguintes,
 * devolve sempre o mesmo link.
 */
export async function getOrCreatePortalLink(leadId: string): Promise<string> {
  const { data: lead, error } = await supabase
    .from("leads")
    .select("portal_token")
    .eq("id", leadId)
    .single();

  if (error) throw error;

  let token = (lead as { portal_token?: string | null })?.portal_token;

  if (!token) {
    token = generateSecureToken();
    const { error: updateError } = await supabase
      .from("leads")
      .update({ portal_token: token } as any)
      .eq("id", leadId);
    if (updateError) throw updateError;
  }

  return `${window.location.origin}/portal/${token}`;
}

/**
 * Regenera o token de uma lead — invalida o link anterior (deixa de
 * funcionar) e cria um novo. Útil se um link tiver sido partilhado
 * indevidamente.
 */
export async function regeneratePortalLink(leadId: string): Promise<string> {
  const token = generateSecureToken();
  const { error } = await supabase
    .from("leads")
    .update({ portal_token: token } as any)
    .eq("id", leadId);
  if (error) throw error;
  return `${window.location.origin}/portal/${token}`;
}
