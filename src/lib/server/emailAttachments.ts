/**
 * Anexos de email guardados na base de dados como JSON — {name, url}, o
 * ficheiro em Supabase Storage (bucket email_attachments), tal como o
 * seletor de anexos das automações de workflow já grava.
 *
 * Normaliza para o formato que o nodemailer espera ({filename, path}).
 * Reaproveitado por várias origens de email automático (workflows, resposta
 * automática de formulários Meta) — só existia dentro do workflowEngine.ts,
 * extraído para não duplicar a mesma conversão em cada sítio novo.
 */
export function normalizeStoredAttachments(attachments: unknown): { filename: string; path: string }[] | undefined {
  if (!Array.isArray(attachments)) {
    return undefined;
  }

  const normalized = attachments
    .filter((attachment) => attachment && typeof attachment === "object")
    .map((attachment: any) => ({
      filename: attachment.filename || attachment.name || "Anexo",
      path: attachment.url || attachment.path,
    }))
    .filter((attachment) => !!attachment.path);

  return normalized.length > 0 ? normalized : undefined;
}
