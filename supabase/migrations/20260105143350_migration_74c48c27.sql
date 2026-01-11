-- ============================================
-- CORRIGIR POLÍTICAS RLS - CONTACTS
-- ============================================

-- 1. Remover políticas antigas que podem causar conflitos
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Team leads can view their agents contacts" ON contacts;

-- 2. Criar políticas SELECT corretas
-- Admins podem ver todos os contactos
CREATE POLICY "admins_view_all_contacts" ON contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Agentes veem apenas contactos que criaram
CREATE POLICY "agents_view_own_contacts" ON contacts
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'agent'
    )
  );

-- Team leads veem seus contactos + contactos dos agentes da sua equipa
CREATE POLICY "team_leads_view_team_contacts" ON contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'team_lead'
    )
    AND (
      user_id = auth.uid()
      OR user_id IN (
        SELECT id FROM profiles
        WHERE team_lead_id = auth.uid()
      )
    )
  );

-- 3. Verificar políticas SELECT finais de contacts
SELECT 
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'contacts' AND cmd = 'SELECT'
ORDER BY policyname;