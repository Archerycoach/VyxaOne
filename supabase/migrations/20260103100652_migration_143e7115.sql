-- Create bulk_messages table
CREATE TABLE IF NOT EXISTS bulk_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Campaign details
  campaign_name TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'sms', 'whatsapp')),
  subject TEXT,
  message_body TEXT NOT NULL,
  
  -- Recipients
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all_contacts', 'all_leads', 'filtered', 'custom')),
  recipient_filters JSONB DEFAULT '{}'::jsonb,
  recipient_ids UUID[],
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE,
  send_immediately BOOLEAN DEFAULT false,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Results
  error_log JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE bulk_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own bulk messages"
  ON bulk_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bulk messages"
  ON bulk_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bulk messages"
  ON bulk_messages FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own bulk messages"
  ON bulk_messages FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all bulk messages"
  ON bulk_messages FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team bulk messages"
  ON bulk_messages FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead' AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );