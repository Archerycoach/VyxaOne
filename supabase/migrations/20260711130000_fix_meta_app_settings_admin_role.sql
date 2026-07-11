-- A migração 20260626194839 substituiu, por engano, a verificação de
-- "role = 'admin'" por "role = 'broker'" nas políticas desta tabela — mas a
-- própria página (src/pages/admin/integrations.tsx) permite tanto 'admin'
-- como 'broker' acederem. Isto bloqueava qualquer utilizador 'admin' de
-- gravar as suas próprias configurações da Meta. Corrige para aceitar
-- ambos os papéis, alinhado com o que a página já permite.
DROP POLICY IF EXISTS "Apenas admins podem ver configurações Meta" ON meta_app_settings;
DROP POLICY IF EXISTS "Apenas admins podem atualizar configurações Meta" ON meta_app_settings;
DROP POLICY IF EXISTS "Apenas admins podem inserir configurações Meta" ON meta_app_settings;

CREATE POLICY "Apenas admins podem ver configurações Meta" ON meta_app_settings
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));

CREATE POLICY "Apenas admins podem atualizar configurações Meta" ON meta_app_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));

CREATE POLICY "Apenas admins podem inserir configurações Meta" ON meta_app_settings
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));
