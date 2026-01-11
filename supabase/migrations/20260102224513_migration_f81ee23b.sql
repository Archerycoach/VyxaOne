-- CORREÇÃO: Remover políticas recursivas e criar versões seguras
-- Passo 1: Dropar todas as políticas de profiles e system_settings

-- Dropar políticas de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_full_access" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- Dropar políticas de system_settings
DROP POLICY IF EXISTS "admin_system_settings_access" ON system_settings;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON system_settings;

-- Verificar que todas foram removidas
SELECT COUNT(*) as policies_removed 
FROM pg_policies 
WHERE tablename IN ('profiles', 'system_settings');