-- Add lead_id and contact_id columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_lead_id ON properties(lead_id);
CREATE INDEX IF NOT EXISTS idx_properties_contact_id ON properties(contact_id);

-- Add comment to explain the relationship
COMMENT ON COLUMN properties.lead_id IS 'Lead associated with this property (optional)';
COMMENT ON COLUMN properties.contact_id IS 'Contact associated with this property (optional)';