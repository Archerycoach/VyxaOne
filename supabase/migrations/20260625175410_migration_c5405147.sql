ALTER TABLE leads ADD COLUMN IF NOT EXISTS buyer_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seller_status text;

-- Migrar o status atual para os novos campos baseado no tipo de lead
UPDATE leads SET buyer_status = status WHERE lead_type IN ('buyer', 'both') AND buyer_status IS NULL;
UPDATE leads SET seller_status = status WHERE lead_type IN ('seller', 'both') AND seller_status IS NULL;

-- Para as novas leads, o ideal é que, se o buyer/seller_status for null, assuma 'new'