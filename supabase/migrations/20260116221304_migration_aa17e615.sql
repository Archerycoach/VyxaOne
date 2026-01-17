-- PROPERTIES - Hierarquia completa
DROP POLICY IF EXISTS "View properties by hierarchy" ON properties;

CREATE POLICY "View properties by hierarchy"
ON properties FOR SELECT
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