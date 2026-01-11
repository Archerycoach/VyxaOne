-- Adicionar colunas que podem estar em falta na tabela properties
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS rental_price DECIMAL(12,2);

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS postal_code TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS typology TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS energy_rating TEXT;

COMMENT ON COLUMN properties.rental_price IS 'Monthly rental price (if applicable)';
COMMENT ON COLUMN properties.district IS 'District/region of the property';
COMMENT ON COLUMN properties.postal_code IS 'Postal code of the property';
COMMENT ON COLUMN properties.typology IS 'Property typology (T0, T1, T2, etc)';
COMMENT ON COLUMN properties.energy_rating IS 'Energy efficiency rating (A+, A, B, etc)';