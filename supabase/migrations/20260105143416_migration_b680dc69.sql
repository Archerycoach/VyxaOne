-- ============================================
-- CORRIGIR POLÍTICAS RLS - PROPERTIES
-- ============================================

-- 1. REMOVER política permissiva que permite a qualquer um ver todos os imóveis
DROP POLICY IF EXISTS "Anyone can view properties" ON properties;

-- 2. REMOVER políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Team leads can view their agents properties" ON properties;

-- 3. CRIAR políticas corretas seguindo o padrão das leads e contactos

-- 3.1 Admins podem ver todos os imóveis
CREATE POLICY "admins_view_all_properties" ON properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 3.2 Agentes podem ver apenas os imóveis que criaram
CREATE POLICY "agents_view_own_properties" ON properties
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'agent'
    )
  );

-- 3.3 Team leads podem ver:
--     - Imóveis que criaram (user_id = auth.uid())
--     - Imóveis criados pelos agentes da sua equipa
CREATE POLICY "team_leads_view_team_properties" ON properties
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

-- Verificar políticas finais
SELECT 
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'properties' AND cmd = 'SELECT'
ORDER BY policyname;