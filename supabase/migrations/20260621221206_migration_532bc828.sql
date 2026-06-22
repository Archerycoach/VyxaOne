-- Adicionar campos para assinatura de email na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_signature_text text,
ADD COLUMN IF NOT EXISTS email_signature_image_url text;

-- Criar índice para otimizar consultas de assinaturas
CREATE INDEX IF NOT EXISTS idx_profiles_signature ON profiles(email_signature_text, email_signature_image_url) 
WHERE email_signature_text IS NOT NULL OR email_signature_image_url IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN profiles.email_signature_text IS 'Assinatura de email em texto (pode incluir HTML)';
COMMENT ON COLUMN profiles.email_signature_image_url IS 'URL da imagem da assinatura de email';