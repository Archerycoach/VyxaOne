-- CRIAR POLÍTICAS SIMPLES PARA SYSTEM_SETTINGS - VERSÃO FINAL
-- SELECT público (para branding) + sem recursão

-- 1. SELECT: Público (qualquer pessoa pode ler settings como branding)
CREATE POLICY "system_settings_public_read" ON system_settings
  FOR SELECT
  USING (true);

-- 2. INSERT/UPDATE/DELETE: Apenas service role
-- Admins devem usar service role para modificar settings

-- Verificar políticas criadas
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'system_settings'
ORDER BY policyname;