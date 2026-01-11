-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'manager'));

-- Create index on role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);