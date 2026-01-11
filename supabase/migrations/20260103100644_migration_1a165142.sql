-- Create sms_messages table
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- SMS details
  to_number TEXT NOT NULL,
  from_number TEXT,
  message_body TEXT NOT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  message_sid TEXT,
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sms messages"
  ON sms_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sms messages"
  ON sms_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update sms messages"
  ON sms_messages FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all sms messages"
  ON sms_messages FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team sms messages"
  ON sms_messages FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead' AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );