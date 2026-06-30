-- =============================================================================
-- PASSO 3: TABELAS DE CONFIGURAÇÃO/ADMINISTRAÇÃO (ADMIN-ONLY)
-- =============================================================================

-- 3.1: SYSTEM_SETTINGS
DROP POLICY IF EXISTS "Admin can read system settings" ON system_settings;
DROP POLICY IF EXISTS "Admin can update system settings" ON system_settings;

CREATE POLICY "Admin can read system settings" ON system_settings
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin can insert system settings" ON system_settings
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update system settings" ON system_settings
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete system settings" ON system_settings
  FOR DELETE
  USING (is_admin());

-- 3.2: SUBSCRIPTION_PLANS (se existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_plans') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage subscription plans" ON subscription_plans';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view subscription plans" ON subscription_plans';
    
    EXECUTE 'CREATE POLICY "Public can view subscription plans" ON subscription_plans FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Admin can insert subscription plans" ON subscription_plans FOR INSERT WITH CHECK (is_admin())';
    EXECUTE 'CREATE POLICY "Admin can update subscription plans" ON subscription_plans FOR UPDATE USING (is_admin())';
    EXECUTE 'CREATE POLICY "Admin can delete subscription plans" ON subscription_plans FOR DELETE USING (is_admin())';
  END IF;
END $$;

-- 3.3: INTEGRATION_SETTINGS (se existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'integration_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can read integration settings" ON integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can update integration settings" ON integration_settings';
    
    EXECUTE 'CREATE POLICY "Admin can read integration settings" ON integration_settings FOR SELECT USING (is_admin())';
    EXECUTE 'CREATE POLICY "Admin can insert integration settings" ON integration_settings FOR INSERT WITH CHECK (is_admin())';
    EXECUTE 'CREATE POLICY "Admin can update integration settings" ON integration_settings FOR UPDATE USING (is_admin())';
    EXECUTE 'CREATE POLICY "Admin can delete integration settings" ON integration_settings FOR DELETE USING (is_admin())';
  END IF;
END $$;