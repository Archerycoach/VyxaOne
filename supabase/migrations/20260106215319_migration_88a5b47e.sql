-- Adicionar constraints de validação para as novas colunas
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_probability_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_probability_check 
CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100));

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_lead_score_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_lead_score_check 
CHECK (lead_score >= 0 AND lead_score <= 100);