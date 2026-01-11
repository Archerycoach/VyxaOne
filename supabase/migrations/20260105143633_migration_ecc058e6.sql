-- ============================================
-- ADICIONAR POLÍTICA PARA AGENTES ATUALIZAREM
-- LEADS QUE CRIARAM
-- ============================================

-- Adicionar política para agentes atualizarem suas próprias leads
CREATE POLICY "agents_update_own_created_leads"
ON leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'agent'
    AND leads.user_id = auth.uid() -- Lead criada pelo agente
  )
);

-- Verificar todas as políticas UPDATE
SELECT 
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'leads' AND cmd = 'UPDATE'
ORDER BY policyname;