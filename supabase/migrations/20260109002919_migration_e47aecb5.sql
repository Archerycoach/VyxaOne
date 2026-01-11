-- Add is_development and development_name columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_development BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS development_name TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN leads.is_development IS 'Indicates if buyer is looking for property in a specific development';
COMMENT ON COLUMN leads.development_name IS 'Name of the development the buyer is interested in';