-- Passo 4: Criar políticas SIMPLES para system_settings
-- SELECT público (para branding) + admin apenas para modificações

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: SELECT público - Qualquer um pode ler settings (incluindo anônimos para branding)
CREATE POLICY "Anyone can view system settings"
ON system_settings FOR SELECT
USING (true);

-- POLÍTICA 2: INSERT - Apenas durante setup inicial (service_role)
-- Não precisa de política pública, service_role bypass RLS

-- POLÍTICA 3: UPDATE - Apenas service_role (via backend)
-- Não precisa de política pública, service_role bypass RLS

-- POLÍTICA 4: DELETE - Apenas service_role (via backend)
-- Não precisa de política pública, service_role bypass RLS

-- Verificar políticas criadas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'system_settings';