-- FUGA (instância partilhada): estas tabelas tinham SELECT com USING(true),
-- deixando qualquer cliente ver os modelos de email e as regras de automação
-- de todos os outros. Passam a ser visíveis só ao dono.

-- email_templates: cada utilizador vê os SEUS modelos + os partilhados por
-- defeito da aplicação (user_id IS NULL). Nunca os de outros consultores.
DROP POLICY IF EXISTS "Users can view all email templates" ON email_templates;
DROP POLICY IF EXISTS "email_templates_select_scoped" ON email_templates;
CREATE POLICY "email_templates_select_scoped" ON email_templates
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- lead_workflow_rules: automações pessoais — só o dono as vê.
DROP POLICY IF EXISTS "Users can view all workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can view their own workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "lead_workflow_rules_select_scoped" ON lead_workflow_rules;
CREATE POLICY "lead_workflow_rules_select_scoped" ON lead_workflow_rules
  FOR SELECT
  USING (user_id = auth.uid());
