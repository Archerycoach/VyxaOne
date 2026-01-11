-- Passo 3: Dropar políticas de system_settings
DROP POLICY IF EXISTS system_settings_select_policy ON system_settings;
DROP POLICY IF EXISTS system_settings_insert_policy ON system_settings;
DROP POLICY IF EXISTS system_settings_update_policy ON system_settings;
DROP POLICY IF EXISTS system_settings_delete_policy ON system_settings;

-- Verificar remoção
SELECT COUNT(*) as policies_removed 
FROM pg_policies 
WHERE tablename = 'system_settings';