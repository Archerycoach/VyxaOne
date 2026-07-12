-- Cria os buckets de Storage usados pela app para imagens:
--  - "properties": fotos de imóveis e empreendimentos (usadas nas landing pages)
--  - "avatars": foto de perfil do consultor
-- Ambos públicos para que as landing pages públicas consigam mostrar as imagens.
-- Sem estes buckets, o upload falha com "Bucket not found".

INSERT INTO storage.buckets (id, name, public)
VALUES ('properties', 'properties', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública (necessária para as imagens aparecerem nas landing pages).
DROP POLICY IF EXISTS "public_read_property_avatar_images" ON storage.objects;
CREATE POLICY "public_read_property_avatar_images" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('properties', 'avatars'));

-- Utilizadores autenticados podem carregar/atualizar/apagar imagens nestes
-- buckets (o modelo é colaborativo — brokers/team leads gerem imóveis da equipa).
DROP POLICY IF EXISTS "auth_insert_property_avatar_images" ON storage.objects;
CREATE POLICY "auth_insert_property_avatar_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('properties', 'avatars'));

DROP POLICY IF EXISTS "auth_update_property_avatar_images" ON storage.objects;
CREATE POLICY "auth_update_property_avatar_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('properties', 'avatars'));

DROP POLICY IF EXISTS "auth_delete_property_avatar_images" ON storage.objects;
CREATE POLICY "auth_delete_property_avatar_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('properties', 'avatars'));
