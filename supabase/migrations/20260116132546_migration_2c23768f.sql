-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create payment records" ON public.payment_history;

-- Create a restrictive policy that only allows users to create their own payment records
CREATE POLICY "Users can create their own payment records"
  ON public.payment_history
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);