-- Drop existing admin policy and recreate with simpler logic
DROP POLICY IF EXISTS "admins_full_access" ON leads;