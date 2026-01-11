-- Add temperature and birthday fields to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS temperature TEXT CHECK (temperature IN ('cold', 'warm', 'hot')),
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add comment for documentation
COMMENT ON COLUMN leads.temperature IS 'Lead interest level: cold (❄️), warm (🌤️), hot (🔥)';
COMMENT ON COLUMN leads.birthday IS 'Lead birthday date for calendar alerts (optional)';