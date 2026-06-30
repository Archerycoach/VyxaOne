-- Adicionar campo reverse_match_processed à tabela properties
-- para rastrear quais imóveis já foram processados pelo reverse matching

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS reverse_match_processed BOOLEAN DEFAULT NULL;

-- Criar índice para otimizar a query de novos imóveis
CREATE INDEX IF NOT EXISTS idx_properties_reverse_match 
ON properties(created_at, reverse_match_processed) 
WHERE reverse_match_processed IS NULL;

COMMENT ON COLUMN properties.reverse_match_processed IS 
'Flag que indica se este imóvel já foi processado pelo reverse matching (procura de leads interessadas)';