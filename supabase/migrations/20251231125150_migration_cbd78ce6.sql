-- Add contact_id to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_calendar_contact_id ON calendar_events(contact_id);