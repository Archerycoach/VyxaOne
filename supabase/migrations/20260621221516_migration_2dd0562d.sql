-- Adicionar campos para assinatura de email na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_signature_text TEXT,
ADD COLUMN IF NOT EXISTS email_signature_image_url TEXT;

-- Adicionar comentários para documentar as colunas
COMMENT ON COLUMN profiles.email_signature_text IS 'Assinatura de email em texto simples/HTML';
COMMENT ON COLUMN profiles.email_signature_image_url IS 'URL da imagem da assinatura de email';