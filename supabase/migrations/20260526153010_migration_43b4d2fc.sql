-- 1. Helper functions (Seguras contra loops)
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_team_agents() RETURNS setof uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT id FROM profiles WHERE team_lead_id = auth.uid();
$$;

-- ==========================================
-- LEADS
-- ==========================================
DROP POLICY IF EXISTS "View leads by hierarchy" ON leads;
DROP POLICY IF EXISTS "admins_view_all_leads" ON leads;
DROP POLICY IF EXISTS "agents_view_own_leads" ON leads;
DROP POLICY IF EXISTS "team_leads_view_team_leads" ON leads;
DROP POLICY IF EXISTS "leads_isolation_select" ON leads;
DROP POLICY IF EXISTS "leads_isolation_all" ON leads;

CREATE POLICY "leads_isolation_all" ON leads FOR ALL USING (
  user_id = auth.uid() OR 
  assigned_to = auth.uid() OR 
  public.get_user_role() = 'admin' OR 
  (public.get_user_role() = 'team_lead' AND (user_id IN (SELECT public.get_team_agents()) OR assigned_to IN (SELECT public.get_team_agents())))
);

-- ==========================================
-- PROPERTIES (IMÓVEIS)
-- ==========================================
DROP POLICY IF EXISTS "View properties by hierarchy" ON properties;
DROP POLICY IF EXISTS "admins_view_all_properties" ON properties;
DROP POLICY IF EXISTS "agents_view_own_properties" ON properties;
DROP POLICY IF EXISTS "team_leads_view_team_properties" ON properties;
DROP POLICY IF EXISTS "properties_isolation_select" ON properties;
DROP POLICY IF EXISTS "properties_isolation_all" ON properties;

CREATE POLICY "properties_isolation_all" ON properties FOR ALL USING (
  user_id = auth.uid() OR 
  public.get_user_role() = 'admin' OR 
  (public.get_user_role() = 'team_lead' AND user_id IN (SELECT public.get_team_agents()))
);

-- ==========================================
-- CONTACTS (CONTACTOS)
-- ==========================================
DROP POLICY IF EXISTS "View contacts by hierarchy" ON contacts;
DROP POLICY IF EXISTS "admins_view_all_contacts" ON contacts;
DROP POLICY IF EXISTS "agents_view_own_contacts" ON contacts;
DROP POLICY IF EXISTS "team_leads_view_team_contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_isolation_select" ON contacts;
DROP POLICY IF EXISTS "contacts_isolation_all" ON contacts;

CREATE POLICY "contacts_isolation_all" ON contacts FOR ALL USING (
  user_id = auth.uid() OR 
  public.get_user_role() = 'admin' OR 
  (public.get_user_role() = 'team_lead' AND user_id IN (SELECT public.get_team_agents()))
);

-- ==========================================
-- TASKS (TAREFAS)
-- ==========================================
DROP POLICY IF EXISTS "View tasks by hierarchy" ON tasks;
DROP POLICY IF EXISTS "tasks_isolation_select" ON tasks;
DROP POLICY IF EXISTS "tasks_isolation_all" ON tasks;

CREATE POLICY "tasks_isolation_all" ON tasks FOR ALL USING (
  user_id = auth.uid() OR 
  assigned_to = auth.uid() OR 
  public.get_user_role() = 'admin' OR 
  (public.get_user_role() = 'team_lead' AND (user_id IN (SELECT public.get_team_agents()) OR assigned_to IN (SELECT public.get_team_agents())))
);

-- ==========================================
-- INTERACTIONS (INTERAÇÕES)
-- ==========================================
DROP POLICY IF EXISTS "View interactions by hierarchy" ON interactions;
DROP POLICY IF EXISTS "interactions_isolation_select" ON interactions;
DROP POLICY IF EXISTS "interactions_isolation_all" ON interactions;

CREATE POLICY "interactions_isolation_all" ON interactions FOR ALL USING (
  user_id = auth.uid() OR 
  public.get_user_role() = 'admin' OR 
  (public.get_user_role() = 'team_lead' AND user_id IN (SELECT public.get_team_agents()))
);