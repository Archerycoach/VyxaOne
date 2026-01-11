-- Function to create first admin user
-- This should be run manually after first user signs up
-- Replace 'YOUR_USER_EMAIL@example.com' with the actual email

-- Example usage:
-- First, sign up with your email through the app
-- Then run this query replacing the email:

-- UPDATE profiles 
-- SET role = 'admin', is_active = true
-- WHERE email = 'YOUR_USER_EMAIL@example.com';

-- For now, create a migration that sets the first user as admin
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first user (no other profiles exist)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id != NEW.id) THEN
    NEW.role := 'admin';
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to make first user admin automatically
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON profiles;
CREATE TRIGGER make_first_user_admin_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION make_first_user_admin();