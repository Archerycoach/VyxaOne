-- Add email notification preferences to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_daily_tasks BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_daily_events BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_new_lead_assigned BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.email_daily_tasks IS 'Send daily email with tasks list';
COMMENT ON COLUMN profiles.email_daily_events IS 'Send daily email with calendar events';
COMMENT ON COLUMN profiles.email_new_lead_assigned IS 'Send email when new lead is assigned';

-- Create index for faster queries on notification settings
CREATE INDEX IF NOT EXISTS idx_profiles_email_notifications 
ON profiles(email_daily_tasks, email_daily_events, email_new_lead_assigned) 
WHERE email_daily_tasks = true OR email_daily_events = true OR email_new_lead_assigned = true;