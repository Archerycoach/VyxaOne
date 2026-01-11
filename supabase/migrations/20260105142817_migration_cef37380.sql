-- ============================================
-- ADICIONAR POLÍTICA PARA AGENTES VEREM
-- AS LEADS QUE ELES PRÓPRIOS CRIARAM
-- ============================================

-- Política para agentes verem leads criadas por eles
CREATE POLICY "agents_view_own_created_leads"
ON leads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'agent'
);

-- Verificar todas as políticas SELECT finais
SELECT 
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'leads' AND cmd = 'SELECT'
ORDER BY policyname;