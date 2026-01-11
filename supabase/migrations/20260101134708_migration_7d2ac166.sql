-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- Enable RLS on all tables that don't have it
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES FOR PROPERTIES
-- =====================================================

-- Admins can do everything
CREATE POLICY "Admins can view all properties" ON properties FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert properties" ON properties FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update properties" ON properties FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete properties" ON properties FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Team leads can view their team's properties
CREATE POLICY "Team leads can view team properties" ON properties FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND user_id IN (
      SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );

-- Agents can view their own properties
CREATE POLICY "Agents can view own properties" ON properties FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own properties
CREATE POLICY "Users can insert own properties" ON properties FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own properties
CREATE POLICY "Users can update own properties" ON properties FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own properties
CREATE POLICY "Users can delete own properties" ON properties FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR LEADS
-- =====================================================

-- Admins can do everything
CREATE POLICY "Admins can view all leads" ON leads FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert leads" ON leads FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update leads" ON leads FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete leads" ON leads FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Team leads can view their team's leads
CREATE POLICY "Team leads can view team leads" ON leads FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND (
      user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
      OR assigned_to IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
    )
  );

-- Agents can view leads assigned to them or created by them
CREATE POLICY "Agents can view assigned leads" ON leads FOR SELECT
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

-- Users can insert their own leads
CREATE POLICY "Users can insert own leads" ON leads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update leads they own or are assigned to
CREATE POLICY "Users can update assigned leads" ON leads FOR UPDATE
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

-- Users can delete their own leads
CREATE POLICY "Users can delete own leads" ON leads FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR CONTACTS
-- =====================================================

CREATE POLICY "Admins can view all contacts" ON contacts FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team contacts" ON contacts FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own contacts" ON contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR TASKS
-- =====================================================

CREATE POLICY "Admins can view all tasks" ON tasks FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team tasks" ON tasks FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND (
      user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
      OR assigned_to IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
    )
  );

CREATE POLICY "Users can view assigned tasks" ON tasks FOR SELECT
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update assigned tasks" ON tasks FOR UPDATE
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR CALENDAR_EVENTS
-- =====================================================

CREATE POLICY "Admins can view all events" ON calendar_events FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team events" ON calendar_events FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can view own events" ON calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own events" ON calendar_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events" ON calendar_events FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own events" ON calendar_events FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR INTERACTIONS
-- =====================================================

CREATE POLICY "Admins can view all interactions" ON interactions FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team interactions" ON interactions FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can view own interactions" ON interactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own interactions" ON interactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own interactions" ON interactions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own interactions" ON interactions FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR DOCUMENTS
-- =====================================================

CREATE POLICY "Admins can view all documents" ON documents FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team documents" ON documents FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'
    AND user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can view own documents" ON documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents" ON documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents" ON documents FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents" ON documents FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR NOTIFICATIONS
-- =====================================================

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR TEMPLATES
-- =====================================================

CREATE POLICY "Admins can view all templates" ON templates FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view own templates" ON templates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own templates" ON templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates" ON templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates" ON templates FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR WORKFLOW RULES
-- =====================================================

CREATE POLICY "Admins can view all workflows" ON lead_workflow_rules FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view own workflows" ON lead_workflow_rules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workflows" ON lead_workflow_rules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workflows" ON lead_workflow_rules FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workflows" ON lead_workflow_rules FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR IMAGE_UPLOADS
-- =====================================================

CREATE POLICY "Users can view own images" ON image_uploads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own images" ON image_uploads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own images" ON image_uploads FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR SUBSCRIPTIONS
-- =====================================================

CREATE POLICY "Admins can view all subscriptions" ON subscriptions FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert subscriptions" ON subscriptions FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update subscriptions" ON subscriptions FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- CREATE RLS POLICIES FOR PAYMENT_HISTORY
-- =====================================================

CREATE POLICY "Admins can view all payments" ON payment_history FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view own payments" ON payment_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert payments" ON payment_history FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- CREATE RLS POLICIES FOR ACTIVITY_LOGS
-- =====================================================

CREATE POLICY "Admins can view all activity logs" ON activity_logs FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view own activity logs" ON activity_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert activity logs" ON activity_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- CREATE RLS POLICIES FOR WORKFLOW_EXECUTIONS
-- =====================================================

CREATE POLICY "Admins can view all executions" ON workflow_executions FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "System can insert executions" ON workflow_executions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update executions" ON workflow_executions FOR UPDATE
  USING (true);

-- =====================================================
-- CREATE RLS POLICIES FOR PROPERTY_MATCHES
-- =====================================================

CREATE POLICY "Admins can view all matches" ON property_matches FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view matches for their leads" ON property_matches FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "System can insert matches" ON property_matches FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update matches" ON property_matches FOR UPDATE
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid()
    )
  );

-- =====================================================
-- CREATE RLS POLICIES FOR INTEGRATION_SETTINGS
-- =====================================================

CREATE POLICY "Users can view own integrations" ON integration_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own integrations" ON integration_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own integrations" ON integration_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own integrations" ON integration_settings FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- CREATE RLS POLICIES FOR SUBSCRIPTION_PLANS
-- =====================================================

-- Everyone can view subscription plans
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans FOR SELECT
  USING (true);

-- Only admins can manage plans
CREATE POLICY "Admins can insert plans" ON subscription_plans FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update plans" ON subscription_plans FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete plans" ON subscription_plans FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- CREATE RLS POLICIES FOR SYSTEM_SETTINGS
-- =====================================================

-- Everyone can view system settings
CREATE POLICY "Anyone can view system settings" ON system_settings FOR SELECT
  USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can insert settings" ON system_settings FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update settings" ON system_settings FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete settings" ON system_settings FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');