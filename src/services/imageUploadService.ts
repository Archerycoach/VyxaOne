import { supabase } from "@/integrations/supabase/client";

export type EntityType = "profile" | "property" | "system";

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Upload de imagem para o Supabase Storage
 * @param file - Arquivo de imagem
 * @param entityType - Tipo de entidade (profile ou property)
 * @param entityId - ID da entidade (opcional)
 * @returns Resultado do upload com URL pública
 */
export const uploadImage = async (
  file: File,
  entityType: EntityType,
  entityId?: string
): Promise<UploadResult> => {
  try {
    // Validar tipo de arquivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: "Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.",
      };
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "Arquivo muito grande. Tamanho máximo: 5MB.",
      };
    }

    // Obter utilizador autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: "Utilizador não autenticado.",
      };
    }

    // Gerar nome único para o arquivo
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `${entityType}_${timestamp}_${randomStr}.${fileExt}`;

    // Determinar bucket baseado no tipo de entidade
    const bucket = entityType === "profile" ? "avatars" : "properties";
    
    // Criar path: user_id/filename
    const filePath = `${user.id}/${fileName}`;

    // Upload para o Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Erro no upload:", uploadError);
      return {
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`,
      };
    }

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: "Erro ao obter URL pública da imagem.",
      };
    }

    // Registrar upload na tabela image_uploads
    const { error: dbError } = await supabase
      .from("image_uploads")
      .insert({
        user_id: user.id,
        file_name: fileName,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        entity_type: entityType,
        entity_id: entityId || null,
      });

    if (dbError) {
      console.error("⚠️ Aviso: Erro ao registrar upload na BD:", dbError);
      // Não falhar o upload por erro no registo
    }

    return {
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error("❌ Erro inesperado no upload:", error);
    return {
      success: false,
      error: "Erro inesperado ao fazer upload da imagem.",
    };
  }
};

/**
 * Deletar imagem do Supabase Storage
 * @param filePath - Caminho do arquivo no storage
 * @param entityType - Tipo de entidade (profile ou property)
 * @returns Resultado da operação
 */
export const deleteImage = async (
  filePath: string,
  entityType: EntityType
): Promise<{ success: boolean; error?: string }> => {
  try {
    const bucket = entityType === "profile" ? "avatars" : "properties";

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error("❌ Erro ao deletar imagem:", error);
      return {
        success: false,
        error: `Erro ao deletar imagem: ${error.message}`,
      };
    }

    // Deletar registo da tabela image_uploads
    await supabase.from("image_uploads").delete().eq("file_path", filePath);

    return { success: true };
  } catch (error) {
    console.error("❌ Erro inesperado ao deletar:", error);
    return {
      success: false,
      error: "Erro inesperado ao deletar imagem.",
    };
  }
};

/**
 * Atualizar avatar do utilizador
 * @param file - Arquivo de imagem
 * @returns URL da nova imagem de avatar
 */
export const updateUserAvatar = async (file: File): Promise<UploadResult> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: "Utilizador não autenticado.",
      };
    }

    // Obter avatar antigo para deletar
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    // Upload nova imagem
    const uploadResult = await uploadImage(file, "profile", user.id);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Atualizar profile com nova URL
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: uploadResult.url })
      .eq("id", user.id);

    if (updateError) {
      console.error("❌ Erro ao atualizar profile:", updateError);
      return {
        success: false,
        error: "Erro ao atualizar perfil com nova imagem.",
      };
    }

    // Deletar avatar antigo (se existir)
    if (profile?.avatar_url && uploadResult.path) {
      const oldPath = profile.avatar_url.split("/").slice(-2).join("/");
      await deleteImage(oldPath, "profile");
    }

    return uploadResult;
  } catch (error) {
    console.error("❌ Erro ao atualizar avatar:", error);
    return {
      success: false,
      error: "Erro inesperado ao atualizar avatar.",
    };
  }
};

/**
 * Adicionar imagem a um imóvel
 * @param file - Arquivo de imagem
 * @param propertyId - ID do imóvel
 * @param isMainImage - Se é a imagem principal
 * @returns URL da imagem
 */
export const addPropertyImage = async (
  file: File,
  propertyId: string,
  isMainImage: boolean = false
): Promise<UploadResult> => {
  try {
    // Upload da imagem
    const uploadResult = await uploadImage(file, "property", propertyId);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Obter imóvel atual
    const { data: property, error: fetchError } = await supabase
      .from("properties")
      .select("main_image_url, images")
      .eq("id", propertyId)
      .single();

    if (fetchError) {
      console.error("❌ Erro ao buscar imóvel:", fetchError);
      return {
        success: false,
        error: "Erro ao buscar imóvel.",
      };
    }

    // Atualizar imóvel
    const updateData: { main_image_url?: string; images?: string[] } = {};

    if (isMainImage) {
      updateData.main_image_url = uploadResult.url;
    } else {
      const currentImages = property?.images || [];
      updateData.images = [...currentImages, uploadResult.url!];
    }

    const { error: updateError } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", propertyId);

    if (updateError) {
      console.error("❌ Erro ao atualizar imóvel:", updateError);
      return {
        success: false,
        error: "Erro ao atualizar imóvel com nova imagem.",
      };
    }

    return uploadResult;
  } catch (error) {
    console.error("❌ Erro ao adicionar imagem ao imóvel:", error);
    return {
      success: false,
      error: "Erro inesperado ao adicionar imagem.",
    };
  }
};

/**
 * Remover imagem de um imóvel
 * @param propertyId - ID do imóvel
 * @param imageUrl - URL da imagem a remover
 * @param isMainImage - Se é a imagem principal
 */
export const removePropertyImage = async (
  propertyId: string,
  imageUrl: string,
  isMainImage: boolean = false
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Extrair path da URL
    const urlParts = imageUrl.split("/");
    const filePath = urlParts.slice(-2).join("/");

    // Deletar do storage
    const deleteResult = await deleteImage(filePath, "property");
    if (!deleteResult.success) {
      return deleteResult;
    }

    // Atualizar imóvel
    if (isMainImage) {
      await supabase
        .from("properties")
        .update({ main_image_url: null })
        .eq("id", propertyId);
    } else {
      const { data: property } = await supabase
        .from("properties")
        .select("images")
        .eq("id", propertyId)
        .single();

      if (property?.images) {
        const updatedImages = property.images.filter((img: string) => img !== imageUrl);
        await supabase
          .from("properties")
          .update({ images: updatedImages })
          .eq("id", propertyId);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao remover imagem:", error);
    return {
      success: false,
      error: "Erro inesperado ao remover imagem.",
    };
  }
};

/**
 * Listar imagens de um utilizador
 * @param userId - ID do utilizador (opcional, usa o atual se não fornecido)
 */
export const getUserImages = async (userId?: string) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Utilizador não autenticado.");
    }

    const targetUserId = userId || user.id;

    const { data, error } = await supabase
      .from("image_uploads")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("❌ Erro ao listar imagens:", error);
    return [];
  }
};