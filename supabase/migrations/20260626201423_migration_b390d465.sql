-- =============================================================================
-- LIMPEZA COMPLETA E RECRIAÇÃO DE POLICIES HIERÁRQUICAS
-- =============================================================================

-- PASSO 1: Dropar TODAS as policies antigas das tabelas de dados de negócio
DO $$ BEGIN
  -- LEADS
  DROP POLICY IF EXISTS "leads_isolation_all" ON leads;
  DROP POLICY IF EXISTS "admins_full_access" ON leads;
  DROP POLICY IF EXISTS "admins_update_all_leads" ON leads;
  DROP POLICY IF EXISTS "agents_update_assigned_leads" ON leads;
  DROP POLICY IF EXISTS "agents_update_own_created_leads" ON leads;
  DROP POLICY IF EXISTS "authenticated_users_create_leads" ON leads;
  DROP POLICY IF EXISTS "creators_delete_leads" ON leads;
  DROP POLICY IF EXISTS "team_leads_update_team_leads" ON leads;
  
  -- PROPERTIES
  DROP POLICY IF EXISTS "properties_isolation_all" ON properties;
  DROP POLICY IF EXISTS "Users can create properties" ON properties;
  DROP POLICY IF EXISTS "Users can delete their properties" ON properties;
  DROP POLICY IF EXISTS "Users can update their properties" ON properties;
  DROP POLICY IF EXISTS "admins_update_all_properties" ON properties;
  DROP POLICY IF EXISTS "team_leads_update_team_properties" ON properties;
  
  -- CONTACTS
  DROP POLICY IF EXISTS "contacts_isolation_all" ON contacts;
  DROP POLICY IF EXISTS "Users can create contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
  DROP POLICY IF EXISTS "admins_update_all_contacts" ON contacts;
  DROP POLICY IF EXISTS "team_leads_update_team_contacts" ON contacts;
  
  -- TASKS
  DROP POLICY IF EXISTS "tasks_isolation_all" ON tasks;
  DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
  
  -- INTERACTIONS
  DROP POLICY IF EXISTS "interactions_isolation_all" ON interactions;
  DROP POLICY IF EXISTS "Users can create interactions" ON interactions;
  DROP POLICY IF EXISTS "Users can delete their interactions" ON interactions;
  DROP POLICY IF EXISTS "Users can update their interactions" ON interactions;
  
  -- CALENDAR_EVENTS
  DROP POLICY IF EXISTS "Users can create calendar events" ON calendar_events;
  DROP POLICY IF EXISTS "Users can delete their calendar events" ON calendar_events;
  DROP POLICY IF EXISTS "Users can update their calendar events" ON calendar_events;
  DROP POLICY IF EXISTS "View calendar events by hierarchy" ON calendar_events;
  
  -- DEVELOPMENTS
  DROP POLICY IF EXISTS "developments_select_own" ON developments;
  DROP POLICY IF EXISTS "developments_insert_own" ON developments;
  DROP POLICY IF EXISTS "developments_update_own" ON developments;
  DROP POLICY IF EXISTS "developments_delete_own" ON developments;
  
  RAISE NOTICE '✅ Policies antigas dropadas';
END $$;

-- PASSO 2: Criar policies hierárquicas limpas para LEADS
CREATE POLICY "select_leads_hierarchy" ON leads
  FOR SELECT
  USING (
    can_access_record(user_id) OR 
    (assigned_to IS NOT NULL AND can_access_record(assigned_to))
  );

CREATE POLICY "insert_leads_own" ON leads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_leads_hierarchy" ON leads
  FOR UPDATE
  USING (can_access_record(user_id) OR (assigned_to IS NOT NULL AND can_access_record(assigned_to)));

CREATE POLICY "delete_leads_owner_or_admin" ON leads
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 3: Criar policies hierárquicas limpas para PROPERTIES
CREATE POLICY "select_properties_hierarchy" ON properties
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_properties_own" ON properties
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_properties_hierarchy" ON properties
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_properties_owner_or_admin" ON properties
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 4: Criar policies hierárquicas limpas para CONTACTS
CREATE POLICY "select_contacts_hierarchy" ON contacts
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_contacts_own" ON contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_contacts_hierarchy" ON contacts
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_contacts_owner_or_admin" ON contacts
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 5: Criar policies hierárquicas limpas para TASKS
CREATE POLICY "select_tasks_hierarchy" ON tasks
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_tasks_own" ON tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_tasks_hierarchy" ON tasks
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_tasks_owner_or_admin" ON tasks
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 6: Criar policies hierárquicas limpas para INTERACTIONS
CREATE POLICY "select_interactions_hierarchy" ON interactions
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_interactions_own" ON interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_interactions_hierarchy" ON interactions
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_interactions_owner_or_admin" ON interactions
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 7: Criar policies hierárquicas limpas para CALENDAR_EVENTS
CREATE POLICY "select_calendar_events_hierarchy" ON calendar_events
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_calendar_events_own" ON calendar_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_calendar_events_hierarchy" ON calendar_events
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_calendar_events_owner_or_admin" ON calendar_events
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- PASSO 8: Criar policies hierárquicas limpas para DEVELOPMENTS
CREATE POLICY "select_developments_hierarchy" ON developments
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "insert_developments_own" ON developments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_developments_hierarchy" ON developments
  FOR UPDATE
  USING (can_access_record(user_id));

CREATE POLICY "delete_developments_owner_or_admin" ON developments
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

DO $$ BEGIN
  RAISE NOTICE '✅ Policies hierárquicas criadas para todas as tabelas de dados de negócio';
END $$;