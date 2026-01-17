-- Corrigir política de lead_notes usando a estrutura correta
DROP POLICY IF EXISTS "View lead notes based on role hierarchy" ON lead_notes;

CREATE POLICY "View lead notes based on role hierarchy"
ON lead_notes FOR SELECT
TO public
USING (
  -- Admins veem tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Team Leads veem notas dos leads dos seus agentes + suas próprias
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND (
      -- Suas próprias notas
      created_by = auth.uid()
      OR
      -- Notas de leads dos seus agentes
      lead_id IN (
        SELECT l.id 
        FROM leads l
        JOIN profiles p ON l.user_id = p.id
        WHERE p.team_lead_id = auth.uid()
      )
    )
  )
  OR
  -- Agentes veem apenas suas próprias notas
  (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    )
  )
);