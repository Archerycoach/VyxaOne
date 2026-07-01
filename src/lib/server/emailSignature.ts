import type { SupabaseClient } from "@supabase/supabase-js";
import { collapseEmptyBlocks } from "@/lib/emailSignatureFormat";

/**
 * FONTE DE VERDADE DA ASSINATURA DE EMAIL.
 *
 * Lê a assinatura configurada nas definições do utilizador (perfil) e devolve
 * o HTML pronto a acrescentar a um email. TODOS os caminhos de envio da
 * aplicação (email da IA, mensagens em massa, automações, crons, etc.) devem
 * usar este módulo, para que a assinatura seja sempre a mesma — a que está
 * configurada nas definições.
 *
 * A assinatura (email_signature_text) já é HTML formatado (feito no editor de
 * assinatura), por isso é inserida TAL COMO ESTÁ, sem transformações.
 *
 * IMPORTANTE: como a assinatura passa a ser acrescentada centralmente, os
 * corpos de email (incluindo os modelos de automação) NÃO devem conter a
 * assinatura — caso contrário ela apareceria duas vezes.
 */
export async function getSignatureHtml(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    if (!userId) return "";
    const { data } = await supabase
      .from("profiles")
      .select("email_signature_text, email_signature_image_url")
      .eq("id", userId)
      .single();

    if (!data) return "";
    const sigText = (data as { email_signature_text?: string | null }).email_signature_text || null;
    const sigImage = (data as { email_signature_image_url?: string | null }).email_signature_image_url || null;

    if (!sigText && !sigImage) return "";

    let html = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eaeaea;">';
    if (sigText) {
      // Já é HTML — inserir tal como está, apenas sem parágrafos vazios
      // (que criam espaço em branco excessivo antes da fotografia).
      html += collapseEmptyBlocks(sigText);
    }
    if (sigImage) {
      html += `<br><img src="${sigImage}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
    }
    html += "</div>";
    return html;
  } catch (err) {
    console.error("[emailSignature] erro ao obter assinatura:", err);
    return "";
  }
}

/**
 * Acrescenta a assinatura configurada ao HTML de um email.
 * Se não houver assinatura configurada, devolve o HTML inalterado.
 */
export async function appendSignature(
  html: string,
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const signature = await getSignatureHtml(supabase, userId);
  return signature ? `${html}${signature}` : html;
}
