-- DROPAR TODAS AS POLÍTICAS DE SYSTEM_SETTINGS EXPLICITAMENTE
DROP POLICY IF EXISTS "Admins can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can insert system settings" ON system_settings;
DROP POLICY IF EXISTS "Anyone can view system settings" ON system_settings;

-- Verificar que TODAS foram removidas
SELECT COUNT(*) as remaining_policies 
FROM pg_policies 
WHERE tablename = 'system_settings';