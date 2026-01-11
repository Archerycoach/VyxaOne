-- Adicionar coluna deleted_at à tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN profiles.deleted_at IS 'Soft delete timestamp - null means record is active';