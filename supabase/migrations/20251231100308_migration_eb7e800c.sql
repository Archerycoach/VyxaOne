-- Adicionar deleted_at à tabela image_uploads e criar índice correto
ALTER TABLE image_uploads 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índice com a coluna correta (created_at)
DROP INDEX IF EXISTS idx_image_uploads_active;
CREATE INDEX IF NOT EXISTS idx_image_uploads_active 
ON image_uploads(created_at) 
WHERE deleted_at IS NULL;

COMMENT ON COLUMN image_uploads.deleted_at IS 'Soft delete timestamp';
COMMENT ON INDEX idx_image_uploads_active IS 'Index for active image uploads only';