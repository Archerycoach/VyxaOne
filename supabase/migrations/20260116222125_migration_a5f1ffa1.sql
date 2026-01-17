-- ===================================
-- LIMPEZA DE POLÍTICAS REDUNDANTES
-- ===================================

-- Remover políticas antigas de calendar_events
DROP POLICY IF EXISTS "View events based on role hierarchy" ON calendar_events;
DROP POLICY IF EXISTS "Users can view their calendar events" ON calendar_events;

-- Remover políticas antigas de tasks
DROP POLICY IF EXISTS "View tasks based on role hierarchy" ON tasks;

-- Remover políticas antigas de interactions
DROP POLICY IF EXISTS "View interactions based on role hierarchy" ON interactions;
DROP POLICY IF EXISTS "Users can view their interactions" ON interactions;

-- Remover políticas redundantes de leads
DROP POLICY IF EXISTS "admins_view_all_leads" ON leads;
DROP POLICY IF EXISTS "agents_view_assigned_leads" ON leads;
DROP POLICY IF EXISTS "agents_view_own_created_leads" ON leads;
DROP POLICY IF EXISTS "team_leads_view_team_leads" ON leads;