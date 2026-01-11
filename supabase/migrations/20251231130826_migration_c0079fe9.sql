-- Create integration_settings table for secure API key storage
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status TEXT CHECK (test_status IN ('success', 'failed', 'pending', 'not_tested')),
  test_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage integrations
CREATE POLICY "Only admins can view integrations" ON integration_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert integrations" ON integration_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update integrations" ON integration_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete integrations" ON integration_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_name ON integration_settings(integration_name);

-- Insert default integrations
INSERT INTO integration_settings (integration_name, settings, is_active, test_status) VALUES
  ('whatsapp', '{"phoneNumberId": "", "accessToken": ""}', false, 'not_tested'),
  ('google_calendar', '{"clientId": "", "clientSecret": "", "redirectUri": ""}', false, 'not_tested'),
  ('stripe', '{"publishableKey": "", "secretKey": "", "webhookSecret": ""}', false, 'not_tested'),
  ('eupago', '{"apiKey": "", "webhookKey": ""}', false, 'not_tested'),
  ('google_maps', '{"apiKey": ""}', false, 'not_tested'),
  ('sendgrid', '{"apiKey": "", "fromEmail": "", "fromName": ""}', false, 'not_tested'),
  ('twilio', '{"accountSid": "", "authToken": "", "phoneNumber": ""}', false, 'not_tested'),
  ('firebase', '{"projectId": "", "apiKey": "", "messagingSenderId": ""}', false, 'not_tested')
ON CONFLICT (integration_name) DO NOTHING;