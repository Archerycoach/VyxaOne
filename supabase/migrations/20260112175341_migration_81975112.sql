-- Remover a constraint leads_source_check para permitir fontes customizáveis
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_source_check;