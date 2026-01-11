-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Admins can manage integrations" ON portal_integrations;
DROP POLICY IF EXISTS "Users can view integrations" ON portal_integrations;

-- Recreate policies
CREATE POLICY "Admins can manage integrations" ON portal_integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view integrations" ON portal_integrations FOR SELECT USING (true);