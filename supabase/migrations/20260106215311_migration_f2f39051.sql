-- Adicionar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_leads_probability ON leads(probability DESC) WHERE probability IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC) WHERE lead_score > 0;
CREATE INDEX IF NOT EXISTS idx_leads_value ON leads(estimated_value DESC) WHERE estimated_value > 0;