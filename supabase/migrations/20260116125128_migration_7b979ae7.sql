-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create activity logs" ON public.activity_logs;

-- Create a secure policy that only allows users to create their own activity logs
CREATE POLICY "Users can create their own activity logs"
  ON public.activity_logs
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);