ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS auto_message_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES leads(id);

-- Criar índice para performance em datas (útil para jobs de aniversário)
CREATE INDEX IF NOT EXISTS idx_contacts_birth_date ON contacts(birth_date);