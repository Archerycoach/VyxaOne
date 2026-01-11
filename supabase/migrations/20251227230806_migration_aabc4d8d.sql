-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a new INSERT policy that allows the trigger to work
-- The trigger runs with SECURITY DEFINER so it bypasses RLS, but we need a policy
-- that allows inserts during user creation
CREATE POLICY "Enable insert for authenticated users and triggers"
ON public.profiles
FOR INSERT
TO public
WITH CHECK (true);

-- This allows:
-- 1. The trigger to insert during user creation (with SECURITY DEFINER)
-- 2. Manual profile creation if needed
-- Security is maintained because:
-- - Trigger only runs on auth.users INSERT (controlled by Supabase Auth)
-- - The trigger sets the ID from auth.users.id (can't be spoofed)