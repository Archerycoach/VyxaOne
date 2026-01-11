-- Create SMTP settings table for users
CREATE TABLE IF NOT EXISTS user_smtp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_smtp_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own SMTP settings"
  ON user_smtp_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SMTP settings"
  ON user_smtp_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMTP settings"
  ON user_smtp_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMTP settings"
  ON user_smtp_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_smtp_settings_user_id ON user_smtp_settings(user_id);

COMMENT ON TABLE user_smtp_settings IS 'SMTP configuration settings for user email sending';