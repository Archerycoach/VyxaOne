-- Check if leads table has proper RLS policies for SELECT
-- Drop existing problematic policies if any
DROP POLICY IF EXISTS "Users can view all leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated users to view leads" ON leads;

-- Create comprehensive SELECT policy that allows all authenticated users to view all leads
CREATE POLICY "authenticated_users_select_all_leads" ON leads
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Verify the policy was created
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads' AND cmd = 'SELECT';