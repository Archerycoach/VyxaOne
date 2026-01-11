-- Add user_id to leads table for multi-tenancy
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- Add user_id to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);

-- Add company and settings to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "notifications": {
    "email": true,
    "push": true,
    "sms": false
  },
  "theme": "light",
  "language": "pt"
}'::jsonb;

-- Add google calendar integration fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP WITH TIME ZONE;