-- 1. Adicionar coluna archived_at à tabela leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- 2. Criar índice para melhor performance nas queries de leads não arquivadas
CREATE INDEX IF NOT EXISTS idx_leads_archived_at 
ON leads(archived_at) 
WHERE archived_at IS NULL;

-- 3. Criar índice para leads arquivadas
CREATE INDEX IF NOT EXISTS idx_leads_archived 
ON leads(user_id, archived_at) 
WHERE archived_at IS NOT NULL;