-- Add reply_email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reply_email TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.reply_email IS 'Email address used for reply-to header in sent emails. If not set, uses the account email.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_reply_email ON profiles(reply_email);