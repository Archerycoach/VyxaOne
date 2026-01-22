CREATE TABLE IF NOT EXISTS meta_notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notify_consultant BOOLEAN DEFAULT true,
  notify_client BOOLEAN DEFAULT false,
  consultant_email_template TEXT,
  client_email_template TEXT,
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE meta_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticated users" ON meta_notification_settings FOR ALL USING (auth.role() = 'authenticated');