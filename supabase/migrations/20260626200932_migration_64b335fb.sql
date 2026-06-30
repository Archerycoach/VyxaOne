-- =============================================================================
-- PASSO 5 CORRIGIDO: Templates e automações (partilhados)
-- =============================================================================

-- 5.1: EMAIL_TEMPLATES (já tem as policies corretas)
DROP POLICY IF EXISTS "Users can view all email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update accessible templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete accessible templates" ON email_templates;

CREATE POLICY "Users can view all email templates" ON email_templates
  FOR SELECT
  USING (true);  -- Todos podem ler templates da instância

CREATE POLICY "Users can insert own templates" ON email_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update accessible templates" ON email_templates
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR can_access_record(user_id)
  );

CREATE POLICY "Users can delete accessible templates" ON email_templates
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR can_access_record(user_id)
  );

-- 5.2: LEAD_WORKFLOW_RULES (já tem as policies corretas)
DROP POLICY IF EXISTS "Users can view all workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can insert own workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can update accessible workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can delete accessible workflow rules" ON lead_workflow_rules;

CREATE POLICY "Users can view all workflow rules" ON lead_workflow_rules
  FOR SELECT
  USING (true);  -- Todos podem ler workflows da instância

CREATE POLICY "Users can insert own workflow rules" ON lead_workflow_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update accessible workflow rules" ON lead_workflow_rules
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR can_access_record(user_id)
  );

CREATE POLICY "Users can delete accessible workflow rules" ON lead_workflow_rules
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR can_access_record(user_id)
  );

-- 5.3: WORKFLOW_STEP_EXECUTIONS (mantém como está - já tem policies corretas)

-- 5.4: TEMPLATES (já tem as policies corretas - manter)