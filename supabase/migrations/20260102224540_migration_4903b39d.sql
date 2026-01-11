-- Passo 3: Criar políticas SEGURAS para SYSTEM_SETTINGS
-- Usar APENAS verificações simples sem subqueries

-- Política para SELECT (leitura) - TODOS podem ler settings
CREATE POLICY "system_settings_select_policy" ON system_settings
  FOR SELECT
  USING (
    -- Qualquer usuário autenticado pode ler configurações
    auth.uid() IS NOT NULL
  );

-- Política para INSERT (criação) - Apenas admins
CREATE POLICY "system_settings_insert_policy" ON system_settings
  FOR INSERT
  WITH CHECK (
    -- Bloquear inserções por padrão (apenas via SQL direto por admins)
    false
  );

-- Política para UPDATE (atualização) - Apenas admins
CREATE POLICY "system_settings_update_policy" ON system_settings
  FOR UPDATE
  USING (
    -- Bloquear updates por padrão (apenas via SQL direto por admins)
    false
  );

-- Política para DELETE (exclusão) - Ninguém
CREATE POLICY "system_settings_delete_policy" ON system_settings
  FOR DELETE
  USING (
    -- Bloquear deleções completamente
    false
  );

-- Verificar políticas criadas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'system_settings';