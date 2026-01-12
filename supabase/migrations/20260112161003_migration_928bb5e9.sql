-- Remover a constraint antiga que limita os valores de status
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_status_check;