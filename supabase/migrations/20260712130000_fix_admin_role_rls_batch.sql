-- Mesmo padrão de bug já corrigido em profiles/meta_app_settings/
-- frontend_settings: a migração 20260626194839 recriou várias políticas a
-- exigir role = 'broker', esquecendo o role legado 'admin' (ainda usado em
-- toda a app). Um utilizador com role 'admin' fica bloqueado nestas
-- operações. A query de auditoria (pg_policies) confirmou que, ao vivo, são
-- exatamente estas 8 políticas que ainda têm o problema — corrigem-se todas
-- para aceitar broker OU admin, preservando team_lead onde já existia.

-- goals
DROP POLICY IF EXISTS "Admins and team leads can manage team goals" ON goals;
CREATE POLICY "Admins and team leads can manage team goals" ON goals
  FOR ALL
  USING (
    goal_type = 'team'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role::text IN ('broker', 'admin', 'team_lead')
    )
  );

DROP POLICY IF EXISTS "Admins and team leads can view all goals" ON goals;
CREATE POLICY "Admins and team leads can view all goals" ON goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role::text IN ('broker', 'admin', 'team_lead')
    )
    OR user_id = auth.uid()
  );

-- image_uploads
DROP POLICY IF EXISTS "Admins can view all uploads" ON image_uploads;
CREATE POLICY "Admins can view all uploads" ON image_uploads
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

-- lead_columns_config
DROP POLICY IF EXISTS "Admins can manage lead columns config" ON lead_columns_config;
CREATE POLICY "Admins can manage lead columns config" ON lead_columns_config
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

-- payment_history
DROP POLICY IF EXISTS "Admins can view all payment history" ON payment_history;
CREATE POLICY "Admins can view all payment history" ON payment_history
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

-- subscriptions
DROP POLICY IF EXISTS "Admins can create subscriptions for any user" ON subscriptions;
CREATE POLICY "Admins can create subscriptions for any user" ON subscriptions
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

DROP POLICY IF EXISTS "Admins can update all subscriptions" ON subscriptions;
CREATE POLICY "Admins can update all subscriptions" ON subscriptions
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));
