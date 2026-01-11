-- Create google_calendar_integrations table
CREATE TABLE IF NOT EXISTS google_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  sync_events BOOLEAN DEFAULT true,
  sync_tasks BOOLEAN DEFAULT true,
  sync_notes BOOLEAN DEFAULT false,
  sync_direction TEXT DEFAULT 'both' CHECK (sync_direction IN ('both', 'toGoogle', 'fromGoogle')),
  auto_sync BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  webhook_channel_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE google_calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Google Calendar integration"
  ON google_calendar_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Calendar integration"
  ON google_calendar_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Calendar integration"
  ON google_calendar_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Calendar integration"
  ON google_calendar_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add google_event_id column to calendar_events if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' 
    AND column_name = 'google_event_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT UNIQUE;
    CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);
  END IF;
END $$;

-- Add google_event_id column to tasks if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name = 'google_event_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN google_event_id TEXT UNIQUE;
    CREATE INDEX idx_tasks_google_id ON tasks(google_event_id);
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_calendar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_google_calendar_integrations_updated_at_trigger ON google_calendar_integrations;
CREATE TRIGGER update_google_calendar_integrations_updated_at_trigger
  BEFORE UPDATE ON google_calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_integrations_updated_at();