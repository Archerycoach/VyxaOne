-- Create email_messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Email details
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  
  -- Attachments
  attachments TEXT[],
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  message_id TEXT,
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own email messages"
  ON email_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email messages"
  ON email_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update email messages"
  ON email_messages FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all email messages"
  ON email_messages FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team email messages"
  ON email_messages FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead' AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );