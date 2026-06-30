-- =============================================================================
-- LIMPEZA: Remover policies duplicadas
-- =============================================================================

-- DOCUMENTS - remover antigas duplicadas
DROP POLICY IF EXISTS "Users can create documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their documents" ON documents;
DROP POLICY IF EXISTS "Users can view their documents" ON documents;

-- LEAD_NOTES - remover antigas duplicadas
DROP POLICY IF EXISTS "Users can create lead notes" ON lead_notes;
DROP POLICY IF EXISTS "Users can delete their own lead notes" ON lead_notes;
DROP POLICY IF EXISTS "Users can update their own lead notes" ON lead_notes;
DROP POLICY IF EXISTS "View lead notes based on role hierarchy" ON lead_notes;

-- EMAIL_TEMPLATES - remover duplicadas
DROP POLICY IF EXISTS "Admins can manage all templates" ON email_templates;
DROP POLICY IF EXISTS "Users can manage own templates" ON email_templates;
DROP POLICY IF EXISTS "Everyone can view default templates" ON email_templates;

-- SUBSCRIPTION_PLANS - remover duplicadas
DROP POLICY IF EXISTS "Admins can create subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can delete subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can update subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;

-- SYSTEM_SETTINGS - remover duplicadas antigas
DROP POLICY IF EXISTS "Admins can create system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can delete system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
DROP POLICY IF EXISTS "public_read_non_secrets" ON system_settings;
DROP POLICY IF EXISTS "service_role_only_delete" ON system_settings;
DROP POLICY IF EXISTS "service_role_only_insert" ON system_settings;
DROP POLICY IF EXISTS "service_role_only_read" ON system_settings;
DROP POLICY IF EXISTS "service_role_only_update" ON system_settings;

-- LEAD_WORKFLOW_RULES - remover antigas duplicadas
DROP POLICY IF EXISTS "Users can create workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can delete their workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can update their workflow rules" ON lead_workflow_rules;
DROP POLICY IF EXISTS "Users can view their workflow rules" ON lead_workflow_rules;