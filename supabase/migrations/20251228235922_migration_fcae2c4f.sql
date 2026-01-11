-- Add deleted_at column to profiles table for soft delete
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for better performance on queries filtering deleted users
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

-- Add is_active column to track account status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when user was soft deleted';
COMMENT ON COLUMN profiles.is_active IS 'Whether the user account is active';