-- Add typology column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS typology TEXT;

COMMENT ON COLUMN leads.typology IS 'Property typology (T0, T1, T2, T3, T4, T5+) - can be derived from bedrooms or explicitly set';