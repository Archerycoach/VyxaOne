-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  event_type TEXT CHECK (event_type IN ('meeting', 'viewing', 'call', 'other')),
  google_event_id TEXT UNIQUE,
  attendees JSONB DEFAULT '[]',
  related_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Calendar events policies
CREATE POLICY "Users can view events they created or are attending" ON calendar_events FOR SELECT USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(attendees) AS attendee 
    WHERE attendee::uuid = auth.uid()
  )
);
CREATE POLICY "Users can insert events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their events" ON calendar_events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their events" ON calendar_events FOR DELETE USING (auth.uid() = created_by);

-- Create indexes
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);