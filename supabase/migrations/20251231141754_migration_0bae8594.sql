ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS property_area numeric(12,2),
ADD COLUMN IF NOT EXISTS bedrooms integer,
ADD COLUMN IF NOT EXISTS bathrooms integer;

COMMENT ON COLUMN leads.property_area IS 'Area of the property for sellers';