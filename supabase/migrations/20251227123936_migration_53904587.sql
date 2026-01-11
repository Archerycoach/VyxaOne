-- Add google_synced column to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_synced BOOLEAN DEFAULT false;

-- Add google_event_id index if not exists
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);