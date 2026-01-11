-- Adicionar coluna 'data' à tabela notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS data JSONB;