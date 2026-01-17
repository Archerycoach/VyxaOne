-- LEADS - Hierarquia completa
DROP POLICY IF EXISTS "View leads by hierarchy" ON leads;

CREATE POLICY "View leads by hierarchy"
ON leads FOR SELECT
TO public
USING (
  assigned_to = auth.uid()
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
    assigned_to IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid()
    )
  )
);