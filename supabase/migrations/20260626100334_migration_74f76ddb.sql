-- 1. Remoção das políticas vulneráveis em integration_settings
DROP POLICY IF EXISTS "authenticated_users_view_integration_settings" ON integration_settings;

-- 2. Remoção das políticas vulneráveis em system_settings
DROP POLICY IF EXISTS "Enable insert/update access for all authenticated users tempora" ON system_settings;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON system_settings;
DROP POLICY IF EXISTS "system_settings_public_read" ON system_settings;

-- 3. Limpeza RLS (por segurança) integration_settings
DROP POLICY IF EXISTS "Admins can insert integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Admins can update integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Admins can view integration settings" ON integration_settings;

-- 4. Criar as políticas seguras que obrigam a usar as API Routes
-- A política RLS rejeitará TUDO para o client. Apenas a API Route que usa a role "service_role" consegue ler/escrever.
CREATE POLICY "service_role_only_read" ON integration_settings FOR SELECT USING (false);
CREATE POLICY "service_role_only_insert" ON integration_settings FOR INSERT WITH CHECK (false);
CREATE POLICY "service_role_only_update" ON integration_settings FOR UPDATE USING (false);
CREATE POLICY "service_role_only_delete" ON integration_settings FOR DELETE USING (false);

-- System Settings
CREATE POLICY "service_role_only_read" ON system_settings FOR SELECT USING (false);
CREATE POLICY "service_role_only_insert" ON system_settings FOR INSERT WITH CHECK (false);
CREATE POLICY "service_role_only_update" ON system_settings FOR UPDATE USING (false);
CREATE POLICY "service_role_only_delete" ON system_settings FOR DELETE USING (false);