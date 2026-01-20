-- 2. Adicionar coluna meta_lead_id à tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;

-- Index para buscar leads por meta_lead_id
CREATE INDEX IF NOT EXISTS idx_leads_meta_lead_id ON leads(meta_lead_id);

-- Comentários para documentação
COMMENT ON COLUMN leads.meta_lead_id IS 'ID do lead no Meta Lead Ads';
COMMENT ON COLUMN leads.meta_form_id IS 'ID do formulário Meta que gerou o lead';
COMMENT ON COLUMN leads.meta_ad_id IS 'ID do anúncio Meta que gerou o lead';