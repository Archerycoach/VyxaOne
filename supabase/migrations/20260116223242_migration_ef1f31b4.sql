-- Adicionar coluna reject_unauthorized à tabela user_smtp_settings
ALTER TABLE user_smtp_settings
ADD COLUMN IF NOT EXISTS reject_unauthorized BOOLEAN DEFAULT true;