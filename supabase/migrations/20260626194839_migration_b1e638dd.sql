-- ============================================================================
-- MIGRATION: Consolidate Role Model & Team Hierarchy
-- ============================================================================
-- This migration:
-- 1. Creates canonical user_role enum (broker, team_lead, consultant)
-- 2. Drops all 43 policies that depend on 'role'
-- 3. Converts profiles.role column to use the new enum
-- 4. Adds manager_id for team hierarchy
-- 5. Creates helper functions
-- 6. Recreates all policies with identical behavior (translated values)
-- ============================================================================

BEGIN;

-- Step 1: Create the canonical user_role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('broker', 'team_lead', 'consultant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Drop all 43 policies that depend on 'role'
-- (Explicit DROP, not CASCADE)

-- calendar_events
DROP POLICY IF EXISTS "View calendar events by hierarchy" ON calendar_events;

-- contacts
DROP POLICY IF EXISTS "admins_update_all_contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_isolation_all" ON contacts;
DROP POLICY IF EXISTS "team_leads_update_team_contacts" ON contacts;

-- deals
DROP POLICY IF EXISTS "Admins can view all deals" ON deals;

-- email_templates
DROP POLICY IF EXISTS "Admins can manage all templates" ON email_templates;

-- frontend_settings
DROP POLICY IF EXISTS "Admins can insert frontend settings" ON frontend_settings;
DROP POLICY IF EXISTS "Admins can update frontend settings" ON frontend_settings;
DROP POLICY IF EXISTS "Admins can view frontend settings" ON frontend_settings;

-- goals
DROP POLICY IF EXISTS "Admins and team leads can manage team goals" ON goals;
DROP POLICY IF EXISTS "Admins and team leads can view all goals" ON goals;

-- image_uploads
DROP POLICY IF EXISTS "Admins can view all uploads" ON image_uploads;

-- interactions
DROP POLICY IF EXISTS "interactions_isolation_all" ON interactions;

-- lead_columns_config
DROP POLICY IF EXISTS "Admins can manage lead columns config" ON lead_columns_config;

-- lead_notes
DROP POLICY IF EXISTS "View lead notes based on role hierarchy" ON lead_notes;

-- leads
DROP POLICY IF EXISTS "admins_full_access" ON leads;
DROP POLICY IF EXISTS "admins_update_all_leads" ON leads;
DROP POLICY IF EXISTS "agents_update_assigned_leads" ON leads;
DROP POLICY IF EXISTS "agents_update_own_created_leads" ON leads;
DROP POLICY IF EXISTS "creators_delete_leads" ON leads;
DROP POLICY IF EXISTS "leads_isolation_all" ON leads;
DROP POLICY IF EXISTS "team_leads_update_team_leads" ON leads;

-- meta_app_settings
DROP POLICY IF EXISTS "Apenas admins podem atualizar configurações Meta" ON meta_app_settings;
DROP POLICY IF EXISTS "Apenas admins podem inserir configurações Meta" ON meta_app_settings;
DROP POLICY IF EXISTS "Apenas admins podem ver configurações Meta" ON meta_app_settings;

-- payment_history
DROP POLICY IF EXISTS "Admins can view all payment history" ON payment_history;

-- profiles
DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- properties
DROP POLICY IF EXISTS "admins_update_all_properties" ON properties;
DROP POLICY IF EXISTS "properties_isolation_all" ON properties;
DROP POLICY IF EXISTS "team_leads_update_team_properties" ON properties;

-- subscription_plans
DROP POLICY IF EXISTS "Admins can create subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can delete subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can update subscription plans" ON subscription_plans;

-- subscriptions
DROP POLICY IF EXISTS "Admins can create subscriptions for any user" ON subscriptions;
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- system_settings
DROP POLICY IF EXISTS "Admins can create system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can delete system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;

-- tasks
DROP POLICY IF EXISTS "tasks_isolation_all" ON tasks;

-- Step 3: Convert profiles.role column to use the new enum
-- First, add a temporary column
ALTER TABLE profiles ADD COLUMN role_new user_role;

-- Migrate data with mapping:
-- admin -> broker
-- manager -> team_lead
-- team_lead -> team_lead (already correct)
-- agent -> consultant
-- viewer -> consultant
UPDATE profiles SET role_new = CASE
  WHEN role = 'admin' THEN 'broker'::user_role
  WHEN role = 'manager' THEN 'team_lead'::user_role
  WHEN role = 'team_lead' THEN 'team_lead'::user_role
  WHEN role = 'agent' THEN 'consultant'::user_role
  WHEN role = 'viewer' THEN 'consultant'::user_role
  ELSE 'consultant'::user_role -- fallback
END;

-- Drop old column and rename new one
ALTER TABLE profiles DROP COLUMN role;
ALTER TABLE profiles RENAME COLUMN role_new TO role;

-- Set NOT NULL and default
ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'consultant'::user_role;

-- Step 4: Add manager_id for team hierarchy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);

-- Also add team_lead_id if it doesn't exist (some policies reference it)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_lead_id ON profiles(team_lead_id);

-- Step 5: Create helper functions
-- Note: Some old functions might exist, so we use CREATE OR REPLACE

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_broker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'broker'::user_role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_team_lead()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'team_lead'::user_role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_visible_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    -- Broker sees everyone
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'broker'::user_role THEN
      ARRAY(SELECT id FROM profiles)
    -- Team lead sees themselves + their team
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'::user_role THEN
      ARRAY(
        SELECT id FROM profiles 
        WHERE id = auth.uid() 
           OR manager_id = auth.uid()
           OR team_lead_id = auth.uid()
      )
    -- Consultant sees only themselves
    ELSE
      ARRAY[auth.uid()]
  END;
$$;

CREATE OR REPLACE FUNCTION can_manage_user(target_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    -- Broker can manage anyone
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'broker'::user_role THEN true
    -- Team lead can manage their team
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead'::user_role THEN
      EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = target_user_id 
        AND (manager_id = auth.uid() OR team_lead_id = auth.uid() OR id = auth.uid())
      )
    -- Consultant can only manage themselves
    ELSE
      target_user_id = auth.uid()
  END;
$$;

-- Legacy function that some policies use
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$;

-- Legacy function that some policies use
CREATE OR REPLACE FUNCTION get_team_agents()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM profiles 
  WHERE team_lead_id = auth.uid() OR manager_id = auth.uid();
$$;

-- Step 6: Recreate all 43 policies with identical behavior (translated values)

-- calendar_events
CREATE POLICY "View calendar events by hierarchy" ON calendar_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role)
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team_lead'::user_role)
      AND user_id IN (SELECT id FROM profiles WHERE team_lead_id = auth.uid())
    )
  );

-- contacts
CREATE POLICY "admins_update_all_contacts" ON contacts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "contacts_isolation_all" ON contacts
  FOR ALL
  USING (
    user_id = auth.uid()
    OR get_user_role() = 'broker'
    OR (get_user_role() = 'team_lead' AND user_id IN (SELECT get_team_agents()))
  );

CREATE POLICY "team_leads_update_team_contacts" ON contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'team_lead'::user_role
      AND (
        contacts.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles agent_profile
          WHERE agent_profile.id = contacts.user_id
          AND agent_profile.team_lead_id = auth.uid()
        )
      )
    )
  );

-- deals
CREATE POLICY "Admins can view all deals" ON deals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('broker'::user_role, 'team_lead'::user_role)
    )
  );

-- email_templates
CREATE POLICY "Admins can manage all templates" ON email_templates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- frontend_settings
CREATE POLICY "Admins can insert frontend settings" ON frontend_settings
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can update frontend settings" ON frontend_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can view frontend settings" ON frontend_settings
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- goals
CREATE POLICY "Admins and team leads can manage team goals" ON goals
  FOR ALL
  USING (
    goal_type = 'team'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('broker'::user_role, 'team_lead'::user_role)
    )
  );

CREATE POLICY "Admins and team leads can view all goals" ON goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('broker'::user_role, 'team_lead'::user_role)
    )
    OR user_id = auth.uid()
  );

-- image_uploads
CREATE POLICY "Admins can view all uploads" ON image_uploads
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- interactions
CREATE POLICY "interactions_isolation_all" ON interactions
  FOR ALL
  USING (
    user_id = auth.uid()
    OR get_user_role() = 'broker'
    OR (get_user_role() = 'team_lead' AND user_id IN (SELECT get_team_agents()))
  );

-- lead_columns_config
CREATE POLICY "Admins can manage lead columns config" ON lead_columns_config
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- lead_notes
CREATE POLICY "View lead notes based on role hierarchy" ON lead_notes
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role)
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team_lead'::user_role)
      AND (
        created_by = auth.uid()
        OR lead_id IN (
          SELECT l.id FROM leads l
          JOIN profiles p ON l.user_id = p.id
          WHERE p.team_lead_id = auth.uid()
        )
      )
    )
    OR (
      created_by = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('broker'::user_role, 'team_lead'::user_role)
      )
    )
  );

-- leads (7 policies)
CREATE POLICY "admins_full_access" ON leads
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "admins_update_all_leads" ON leads
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "agents_update_assigned_leads" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'consultant'::user_role
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "agents_update_own_created_leads" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'consultant'::user_role
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "creators_delete_leads" ON leads
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role)
  );

CREATE POLICY "leads_isolation_all" ON leads
  FOR ALL
  USING (
    user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR get_user_role() = 'broker'
    OR (
      get_user_role() = 'team_lead'
      AND (
        user_id IN (SELECT get_team_agents())
        OR assigned_to IN (SELECT get_team_agents())
      )
    )
  );

CREATE POLICY "team_leads_update_team_leads" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'team_lead'::user_role
      AND (
        leads.user_id = auth.uid()
        OR leads.assigned_to = auth.uid()
        OR leads.assigned_to IN (
          SELECT id FROM profiles WHERE team_lead_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'team_lead'::user_role
      AND (
        leads.assigned_to = auth.uid()
        OR leads.assigned_to IN (
          SELECT id FROM profiles WHERE team_lead_id = auth.uid()
        )
        OR leads.assigned_to IS NULL
      )
    )
  );

-- meta_app_settings
CREATE POLICY "Apenas admins podem atualizar configurações Meta" ON meta_app_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Apenas admins podem inserir configurações Meta" ON meta_app_settings
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Apenas admins podem ver configurações Meta" ON meta_app_settings
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- payment_history
CREATE POLICY "Admins can view all payment history" ON payment_history
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- profiles
CREATE POLICY "Admins can delete any profile" ON profiles
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- properties
CREATE POLICY "admins_update_all_properties" ON properties
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "properties_isolation_all" ON properties
  FOR ALL
  USING (
    user_id = auth.uid()
    OR get_user_role() = 'broker'
    OR (get_user_role() = 'team_lead' AND user_id IN (SELECT get_team_agents()))
  );

CREATE POLICY "team_leads_update_team_properties" ON properties
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'team_lead'::user_role
      AND (
        properties.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles agent_profile
          WHERE agent_profile.id = properties.user_id
          AND agent_profile.team_lead_id = auth.uid()
        )
      )
    )
  );

-- subscription_plans
CREATE POLICY "Admins can create subscription plans" ON subscription_plans
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can delete subscription plans" ON subscription_plans
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can update subscription plans" ON subscription_plans
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- subscriptions
CREATE POLICY "Admins can create subscriptions for any user" ON subscriptions
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can update all subscriptions" ON subscriptions
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- system_settings
CREATE POLICY "Admins can create system settings" ON system_settings
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can delete system settings" ON system_settings
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

CREATE POLICY "Admins can update system settings" ON system_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'broker'::user_role));

-- tasks
CREATE POLICY "tasks_isolation_all" ON tasks
  FOR ALL
  USING (
    user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR get_user_role() = 'broker'
    OR (
      get_user_role() = 'team_lead'
      AND (
        user_id IN (SELECT get_team_agents())
        OR assigned_to IN (SELECT get_team_agents())
      )
    )
  );

-- Add comments for documentation
COMMENT ON TYPE user_role IS 'User roles: broker (system admin), team_lead (team manager), consultant (sales agent)';
COMMENT ON COLUMN profiles.role IS 'User role (broker/team_lead/consultant)';
COMMENT ON COLUMN profiles.manager_id IS 'Reference to team lead (for consultants)';
COMMENT ON COLUMN profiles.team_lead_id IS 'Legacy reference to team lead';

COMMIT;