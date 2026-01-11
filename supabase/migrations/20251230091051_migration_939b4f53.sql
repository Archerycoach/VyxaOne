-- =====================================================
-- CREATE COMPREHENSIVE RLS POLICIES FOR ALL TABLES
-- =====================================================

-- ============ PROFILES POLICIES ============
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles" ON profiles 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ CONTACTS POLICIES ============
CREATE POLICY "Users can view their own contacts" ON contacts 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create contacts" ON contacts 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contacts" ON contacts 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own contacts" ON contacts 
  FOR DELETE USING (user_id = auth.uid());

-- ============ LEADS POLICIES ============
CREATE POLICY "Users can view their leads" ON leads 
  FOR SELECT USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can create leads" ON leads 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their leads" ON leads 
  FOR UPDATE USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can delete their leads" ON leads 
  FOR DELETE USING (user_id = auth.uid());

-- ============ PROPERTIES POLICIES ============
CREATE POLICY "Anyone can view properties" ON properties 
  FOR SELECT USING (true);

CREATE POLICY "Users can create properties" ON properties 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their properties" ON properties 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their properties" ON properties 
  FOR DELETE USING (user_id = auth.uid());

-- ============ PROPERTY MATCHES POLICIES ============
CREATE POLICY "Users can view matches for their leads" ON property_matches 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = property_matches.lead_id AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid()))
  );

CREATE POLICY "Users can create property matches" ON property_matches 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = property_matches.lead_id AND leads.user_id = auth.uid())
  );

CREATE POLICY "Users can update their property matches" ON property_matches 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = property_matches.lead_id AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid()))
  );

CREATE POLICY "Users can delete their property matches" ON property_matches 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = property_matches.lead_id AND leads.user_id = auth.uid())
  );

-- ============ TASKS POLICIES ============
CREATE POLICY "Users can view their tasks" ON tasks 
  FOR SELECT USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can create tasks" ON tasks 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their tasks" ON tasks 
  FOR UPDATE USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can delete their tasks" ON tasks 
  FOR DELETE USING (user_id = auth.uid());

-- ============ CALENDAR EVENTS POLICIES ============
CREATE POLICY "Users can view their calendar events" ON calendar_events 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create calendar events" ON calendar_events 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their calendar events" ON calendar_events 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their calendar events" ON calendar_events 
  FOR DELETE USING (user_id = auth.uid());

-- ============ INTERACTIONS POLICIES ============
CREATE POLICY "Users can view their interactions" ON interactions 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create interactions" ON interactions 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their interactions" ON interactions 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their interactions" ON interactions 
  FOR DELETE USING (user_id = auth.uid());

-- ============ DOCUMENTS POLICIES ============
CREATE POLICY "Users can view their documents" ON documents 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create documents" ON documents 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their documents" ON documents 
  FOR DELETE USING (user_id = auth.uid());

-- ============ TEMPLATES POLICIES ============
CREATE POLICY "Users can view their templates" ON templates 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create templates" ON templates 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their templates" ON templates 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their templates" ON templates 
  FOR DELETE USING (user_id = auth.uid());

-- ============ WORKFLOW RULES POLICIES ============
CREATE POLICY "Users can view their workflow rules" ON lead_workflow_rules 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create workflow rules" ON lead_workflow_rules 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their workflow rules" ON lead_workflow_rules 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their workflow rules" ON lead_workflow_rules 
  FOR DELETE USING (user_id = auth.uid());

-- ============ NOTIFICATIONS POLICIES ============
CREATE POLICY "Users can view their notifications" ON notifications 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create notifications" ON notifications 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON notifications 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications" ON notifications 
  FOR DELETE USING (user_id = auth.uid());

-- ============ ACTIVITY LOGS POLICIES ============
CREATE POLICY "Users can view their activity logs" ON activity_logs 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create activity logs" ON activity_logs 
  FOR INSERT WITH CHECK (true);

-- ============ SUBSCRIPTIONS POLICIES ============
CREATE POLICY "Users can view their subscriptions" ON subscriptions 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create subscriptions" ON subscriptions 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their subscriptions" ON subscriptions 
  FOR UPDATE USING (user_id = auth.uid());

-- ============ SUBSCRIPTION PLANS POLICIES ============
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans 
  FOR SELECT USING (true);

CREATE POLICY "Admins can create subscription plans" ON subscription_plans 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update subscription plans" ON subscription_plans 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete subscription plans" ON subscription_plans 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ PAYMENT HISTORY POLICIES ============
CREATE POLICY "Users can view their payment history" ON payment_history 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create payment records" ON payment_history 
  FOR INSERT WITH CHECK (true);

-- ============ SYSTEM SETTINGS POLICIES ============
CREATE POLICY "Admins can view system settings" ON system_settings 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update system settings" ON system_settings 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert system settings" ON system_settings 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );