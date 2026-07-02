import { supabase } from "@/integrations/supabase/client";

export const REACTIVATION_TEMPLATE_NAMES = ["optin_inicial", "optin_lembrete_2", "optin_lembrete_final"] as const;
export type ReactivationTemplateName = (typeof REACTIVATION_TEMPLATE_NAMES)[number];

export const REACTIVATION_TEMPLATE_LABELS: Record<ReactivationTemplateName, string> = {
  optin_inicial: "1ª Tentativa (imediata)",
  optin_lembrete_2: "2ª Tentativa (lembrete, ~3 dias depois)",
  optin_lembrete_final: "3ª Tentativa (último lembrete, ~7 dias depois)",
};

export interface ReactivationTemplate {
  subject: string;
  html_body: string;
  /** true se for a versão personalizada deste consultor; false se estiver a usar a predefinição partilhada. */
  isCustomized: boolean;
}

/**
 * Vai buscar o texto de um template de reativação para este consultor: a
 * sua própria versão personalizada, se existir, ou a predefinição
 * partilhada caso contrário. Mesma lógica de fallback usada pelo cron em
 * src/pages/api/cron/lead-reactivation.ts.
 */
export async function getReactivationTemplate(
  name: ReactivationTemplateName,
  userId: string
): Promise<ReactivationTemplate | null> {
  const { data: own } = await supabase
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", name)
    .eq("user_id", userId)
    .maybeSingle();

  if (own) return { ...own, isCustomized: true };

  const { data: shared } = await supabase
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", name)
    .is("user_id", null)
    .maybeSingle();

  if (shared) return { ...shared, isCustomized: false };

  const { data: anyTemplate } = await supabase
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  return anyTemplate ? { ...anyTemplate, isCustomized: false } : null;
}

/**
 * Guarda a versão personalizada deste consultor para um template de
 * reativação — cria o registo se ainda não existir, ou atualiza-o.
 */
export async function saveReactivationTemplate(
  name: ReactivationTemplateName,
  userId: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("email_templates")
    .select("id")
    .eq("name", name)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("email_templates")
      .update({ subject, html_body: htmlBody, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("email_templates").insert({
      name,
      user_id: userId,
      template_type: "reactivation",
      subject,
      html_body: htmlBody,
      is_default: false,
      is_active: true,
    });
    if (error) throw error;
  }
}

/**
 * Apaga a versão personalizada deste consultor, voltando a usar a
 * predefinição partilhada.
 */
export async function resetReactivationTemplate(name: ReactivationTemplateName, userId: string): Promise<void> {
  const { error } = await supabase.from("email_templates").delete().eq("name", name).eq("user_id", userId);
  if (error) throw error;
}
