-- Fase 1.1: Adicionar campos customizados em leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_preference TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_type TEXT;

COMMENT ON COLUMN leads.budget IS 'Orçamento do lead (capturado da Meta)';
COMMENT ON COLUMN leads.location_preference IS 'Preferência de localização (capturado da Meta)';
COMMENT ON COLUMN leads.property_type IS 'Tipo de imóvel desejado (capturado da Meta)';