-- Adicionar índices para as novas colunas de properties
CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_postal_code ON properties(postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_rental_price ON properties(rental_price) WHERE rental_price IS NOT NULL;