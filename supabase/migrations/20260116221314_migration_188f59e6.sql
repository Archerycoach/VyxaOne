-- CONTACTS - Hierarquia completa
DROP POLICY IF EXISTS "View contacts by hierarchy" ON contacts;

CREATE POLICY "View contacts by hierarchy"
ON contacts FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid()
    )
  )
);