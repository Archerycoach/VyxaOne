-- Drop the existing foreign key constraint
ALTER TABLE contacts 
DROP CONSTRAINT IF EXISTS contacts_lead_source_id_fkey;

-- Re-create the foreign key with ON DELETE SET NULL
ALTER TABLE contacts 
ADD CONSTRAINT contacts_lead_source_id_fkey 
FOREIGN KEY (lead_source_id) 
REFERENCES leads(id) 
ON DELETE SET NULL;

-- Add comment explaining the behavior
COMMENT ON CONSTRAINT contacts_lead_source_id_fkey ON contacts IS 
'Foreign key to leads table. When a lead is deleted, lead_source_id is set to NULL to preserve contact data.';