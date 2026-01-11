-- Dropar política antiga e criar nova com WITH CHECK correto

-- 1. Dropar política antiga
DROP POLICY IF EXISTS "team_leads_update_team_leads" ON leads;

-- 2. Criar nova política com WITH CHECK
CREATE POLICY "team_leads_update_team_leads" ON leads
FOR UPDATE TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'team_lead'
      AND (
        leads.user_id = auth.uid() 
        OR leads.assigned_to = auth.uid()
        OR leads.assigned_to IN (
          SELECT id FROM profiles WHERE team_lead_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  -- ✅ Novo assigned_to deve ser do team do Team Lead
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'team_lead'
      AND (
        leads.assigned_to = auth.uid()
        OR leads.assigned_to IN (
          SELECT id FROM profiles WHERE team_lead_id = auth.uid()
        )
        OR leads.assigned_to IS NULL
      )
  )
);

-- 3. Verificar política criada
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'leads' 
  AND policyname = 'team_leads_update_team_leads';