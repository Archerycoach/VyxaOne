-- Criar bucket 'properties' para fotos de imóveis
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'properties',
  'properties',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de acesso para o bucket 'properties'
-- Permitir que utilizadores autenticados façam upload de fotos de imóveis
CREATE POLICY "Users can upload property images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'properties' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permitir que qualquer utilizador autenticado veja fotos de imóveis
CREATE POLICY "Anyone can view property images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'properties');

-- Permitir que utilizadores deletem fotos dos seus próprios imóveis
CREATE POLICY "Users can delete their property images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'properties' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permitir que utilizadores atualizem fotos dos seus próprios imóveis
CREATE POLICY "Users can update their property images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'properties' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );