import { supabase } from "@/integrations/supabase/client";

/**
 * Anexo de email carregado para a Storage (bucket email_attachments) — o
 * envio e a leitura por IA recebem só o link, nunca o conteúdo em base64.
 *
 * Porquê: embutir base64 no corpo dos pedidos excede o limite de payload das
 * funções serverless (~4,5 MB) com um único ficheiro grande — a resposta da
 * plataforma nem sequer é JSON e o cliente rebentava com "JSON.parse:
 * unexpected character". Mesmo padrão do seletor de anexos das automações
 * (WorkflowsManagement) e do email da ficha da lead.
 */
export interface UploadedEmailAttachment {
  name: string;
  size: number;
  url: string;
}

export async function uploadEmailAttachment(file: File): Promise<UploadedEmailAttachment> {
  const fileExt = file.name.split(".").pop();
  const fileName = `bulk_${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { error } = await supabase.storage.from("email_attachments").upload(fileName, file);
  if (error) throw error;

  const { data } = supabase.storage.from("email_attachments").getPublicUrl(fileName);
  return { name: file.name, size: file.size, url: data.publicUrl };
}
