-- Add missing columns for buyer and seller specific fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS needs_financing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS desired_price numeric(12,2);

-- Add comments for clarity
COMMENT ON COLUMN leads.needs_financing IS 'For buyers: whether they need financing/credit';
COMMENT ON COLUMN leads.desired_price IS 'For sellers: their desired selling price';
COMMENT ON COLUMN leads.property_type IS 'Type of property (apartment, house, commercial, land, etc)';
COMMENT ON COLUMN leads.bedrooms IS 'Number of bedrooms (buyers preference or sellers property)';
COMMENT ON COLUMN leads.bathrooms IS 'Number of bathrooms (sellers property only)';
COMMENT ON COLUMN leads.min_area IS 'Minimum area in sqm (buyers preference or sellers property area)';
COMMENT ON COLUMN leads.location_preference IS 'Location preference for buyers or property location for sellers';