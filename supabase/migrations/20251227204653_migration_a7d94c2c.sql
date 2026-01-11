-- Create user_role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'agent', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'agent';

-- Add is_active column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add created_by column to profiles (for admin tracking)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add last_login column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;