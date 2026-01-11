-- Fix subscriptions RLS to allow admins to create subscriptions for any user
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;

-- Create new INSERT policy for users (their own subscriptions)
CREATE POLICY "Users can create their own subscriptions" ON subscriptions
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

-- Create new INSERT policy for admins (any user's subscriptions)
CREATE POLICY "Admins can create subscriptions for any user" ON subscriptions
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );