-- Adicionar colunas faltantes para corrigir erros de TypeScript
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS auto_message_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS main_image_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;