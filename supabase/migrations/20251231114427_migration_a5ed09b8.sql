-- Drop existing lead policies
DROP POLICY IF EXISTS "Users can view their leads" ON leads;
DROP POLICY IF EXISTS "Users can create leads" ON leads;
DROP POLICY IF EXISTS "Users can update their leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their leads" ON leads;

-- Create comprehensive RLS policies for leads with role-based access

-- SELECT POLICIES (Read Access)
-- 1. Agents: View only leads assigned to them
CREATE POLICY "agents_view_assigned_leads"
ON leads FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'agent'
    AND leads.assigned_to = auth.uid()
  )
);

-- 2. Team Leads: View their own leads + leads of their managed agents
CREATE POLICY "team_leads_view_team_leads"
ON leads FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'team_lead'
    AND (
      -- Team lead's own leads (as creator or assignee)
      leads.user_id = auth.uid()
      OR leads.assigned_to = auth.uid()
      OR 
      -- Leads assigned to agents managed by this team lead
      leads.assigned_to IN (
        SELECT id FROM profiles
        WHERE team_lead_id = auth.uid()
      )
    )
  )
);

-- 3. Admins: View all leads
CREATE POLICY "admins_view_all_leads"
ON leads FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- INSERT POLICIES (Create Access)
-- All authenticated users can create leads (they become user_id)
CREATE POLICY "authenticated_users_create_leads"
ON leads FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
);

-- UPDATE POLICIES (Edit Access)
-- 1. Agents: Update only leads assigned to them
CREATE POLICY "agents_update_assigned_leads"
ON leads FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'agent'
    AND leads.assigned_to = auth.uid()
  )
);

-- 2. Team Leads: Update their own leads + leads of their managed agents
CREATE POLICY "team_leads_update_team_leads"
ON leads FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'team_lead'
    AND (
      leads.user_id = auth.uid()
      OR leads.assigned_to = auth.uid()
      OR 
      leads.assigned_to IN (
        SELECT id FROM profiles
        WHERE team_lead_id = auth.uid()
      )
    )
  )
);

-- 3. Admins: Update all leads
CREATE POLICY "admins_update_all_leads"
ON leads FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- DELETE POLICIES (Delete Access)
-- 1. Only lead creator can delete (or admin)
CREATE POLICY "creators_delete_leads"
ON leads FOR DELETE
TO public
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);