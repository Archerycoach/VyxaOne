-- ============================================
-- ADICIONAR POLÍTICAS UPDATE PARA TEAM LEADS
-- Contacts e Properties
-- ============================================

-- 1. Team Leads podem atualizar contactos dos seus agentes
CREATE POLICY "team_leads_update_team_contacts"
ON contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'team_lead'
    AND (
      contacts.user_id = auth.uid() -- Seus próprios contactos
      OR EXISTS ( -- Contactos dos agentes da equipa
        SELECT 1 FROM profiles agent_profile
        WHERE agent_profile.id = contacts.user_id
        AND agent_profile.team_lead_id = auth.uid()
      )
    )
  )
);

-- 2. Team Leads podem atualizar imóveis dos seus agentes
CREATE POLICY "team_leads_update_team_properties"
ON properties
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'team_lead'
    AND (
      properties.user_id = auth.uid() -- Seus próprios imóveis
      OR EXISTS ( -- Imóveis dos agentes da equipa
        SELECT 1 FROM profiles agent_profile
        WHERE agent_profile.id = properties.user_id
        AND agent_profile.team_lead_id = auth.uid()
      )
    )
  )
);

-- 3. Admins podem atualizar todos os contactos
CREATE POLICY "admins_update_all_contacts"
ON contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 4. Admins podem atualizar todos os imóveis
CREATE POLICY "admins_update_all_properties"
ON properties
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Verificar todas as políticas UPDATE
SELECT 
  'contacts' as table_name,
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'contacts' AND cmd = 'UPDATE'

UNION ALL

SELECT 
  'properties' as table_name,
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'properties' AND cmd = 'UPDATE'

ORDER BY table_name, policyname;