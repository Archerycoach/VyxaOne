-- Add lead_id and property_id columns to calendar_events
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead_id ON calendar_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_property_id ON calendar_events(property_id);

-- Add comments
COMMENT ON COLUMN calendar_events.lead_id IS 'Related lead for the event';
COMMENT ON COLUMN calendar_events.property_id IS 'Related property for the event';