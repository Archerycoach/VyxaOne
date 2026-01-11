-- Criar política para team leads verem seus agentes
CREATE POLICY "Team leads can view their agents"
ON profiles
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'team_lead'
  )
  AND (
    team_lead_id = auth.uid()
    OR id = auth.uid()
  )
);