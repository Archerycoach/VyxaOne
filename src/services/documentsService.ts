import { supabase } from "@/integrations/supabase/client";

export interface DocumentRecord {
  id: string;
  user_id: string;
  lead_id: string | null;
  property_id: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  tags: string[] | null;
  created_at: string | null;
}

export interface UploadDocumentResult {
  success: boolean;
  document?: DocumentRecord;
  error?: string;
}

const BUCKET = "documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB — maior que o limite de imagens, dado incluir digitalizações de contratos
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Envia um documento para o Supabase Storage (bucket privado "documents") e
 * regista os metadados na tabela "documents", opcionalmente associado a uma
 * lead e/ou imóvel.
 */
export async function uploadDocument(
  file: File,
  options: { leadId?: string | null; propertyId?: string | null; tags?: string[] } = {}
): Promise<UploadDocumentResult> {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: "Tipo de ficheiro não suportado. Use PDF, Word, JPEG, PNG ou WebP." };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "Ficheiro demasiado grande. Tamanho máximo: 15MB." };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Utilizador não autenticado." };
    }

    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    // Caminho: {user_id}/{ficheiro} — exigido pelas políticas de RLS do bucket.
    const filePath = `${user.id}/${timestamp}_${randomStr}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      console.error("[documentsService] Erro no upload:", uploadError);
      return { success: false, error: `Erro ao enviar ficheiro: ${uploadError.message}` };
    }

    const { data: docRow, error: dbError } = await (supabase
      .from("documents" as any)
      .insert({
        user_id: user.id,
        lead_id: options.leadId || null,
        property_id: options.propertyId || null,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        tags: options.tags || [],
      })
      .select()
      .single() as any);

    if (dbError) {
      console.error("[documentsService] Erro ao registar documento:", dbError);
      // Reverte o upload para não deixar um ficheiro órfão no storage.
      await supabase.storage.from(BUCKET).remove([filePath]);
      return { success: false, error: `Erro ao registar documento: ${dbError.message}` };
    }

    return { success: true, document: docRow as DocumentRecord };
  } catch (error: any) {
    console.error("[documentsService] Erro inesperado no upload:", error);
    return { success: false, error: error.message || "Erro inesperado ao enviar o documento." };
  }
}

/**
 * Lista os documentos do consultor autenticado, opcionalmente filtrados por
 * lead, imóvel, ou pesquisa por nome.
 */
export async function getDocuments(filters: { leadId?: string; propertyId?: string; search?: string } = {}): Promise<DocumentRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = (supabase
      .from("documents" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }) as any);

    if (filters.leadId) query = query.eq("lead_id", filters.leadId);
    if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
    if (filters.search) query = query.ilike("name", `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as DocumentRecord[];
  } catch (error) {
    console.error("[documentsService] Erro ao listar documentos:", error);
    return [];
  }
}

/**
 * Gera uma URL assinada e temporária (válida por 5 minutos) para
 * visualizar/descarregar um documento — nunca um link público direto, dado
 * o bucket ser privado.
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      console.error("[documentsService] Erro ao gerar URL assinada:", error);
      return null;
    }
    return data.signedUrl;
  } catch (error) {
    console.error("[documentsService] Erro inesperado ao gerar URL:", error);
    return null;
  }
}

/**
 * Apaga um documento — do storage e do registo de metadados.
 */
export async function deleteDocument(id: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (storageError) {
      console.error("[documentsService] Erro ao apagar do storage:", storageError);
      return { success: false, error: storageError.message };
    }

    const { error: dbError } = await (supabase.from("documents" as any).delete().eq("id", id) as any);
    if (dbError) {
      console.error("[documentsService] Erro ao apagar registo:", dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[documentsService] Erro inesperado ao apagar:", error);
    return { success: false, error: error.message || "Erro inesperado ao apagar o documento." };
  }
}
