-- Fix 2: Drop and recreate the problematic RLS policies on profiles to prevent infinite recursion
-- The issue is that the admin policies are checking profiles again, causing a loop

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Allow signup to create profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Recreate policies without recursive checks
-- 1. Allow signup process to create profiles
CREATE POLICY "Allow signup to create profile" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- 2. Users can view their own profile (simple, no subquery)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- 3. Users can update their own profile (simple, no subquery)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- 4. Service role bypass for admin operations (avoids recursion)
CREATE POLICY "Service role full access" ON profiles
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');