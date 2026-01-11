-- Add Google Calendar sync fields to calendar_events table
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'meeting';

-- Add Google Calendar credentials to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;

-- Add index for Google event ID lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);

-- Add index for event type filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- Add comments
COMMENT ON COLUMN calendar_events.google_event_id IS 'Google Calendar event ID for sync';
COMMENT ON COLUMN calendar_events.google_synced IS 'Whether event is synced with Google Calendar';
COMMENT ON COLUMN calendar_events.event_type IS 'Type of event: meeting, birthday, reminder, etc.';
COMMENT ON COLUMN profiles.google_calendar_connected IS 'Whether Google Calendar is connected';