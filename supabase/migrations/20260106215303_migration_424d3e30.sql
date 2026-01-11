-- Adicionar colunas que faltam no esquema para alinhar com os tipos TypeScript

-- Adicionar probability à tabela leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100);

-- Adicionar lead_score à tabela leads (para o sistema de scoring)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);

-- Adicionar estimated_value à tabela leads (para análise financeira)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN leads.probability IS 'Probability of lead conversion (0-100)';
COMMENT ON COLUMN leads.lead_score IS 'Automated lead score based on engagement (0-100)';
COMMENT ON COLUMN leads.estimated_value IS 'Estimated deal value for revenue forecasting';