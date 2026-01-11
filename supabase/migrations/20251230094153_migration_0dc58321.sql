-- Also ensure the profiles table RLS policies allow the trigger to insert
-- Grant usage on the profiles table to the authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Ensure there's a policy that allows inserting during signup
DROP POLICY IF EXISTS "Allow signup to create profile" ON profiles;
CREATE POLICY "Allow signup to create profile" ON profiles
  FOR INSERT
  WITH CHECK (true);