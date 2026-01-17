-- ===================================
-- CORREÇÃO CRÍTICA: ISOLAMENTO TOTAL
-- ===================================

-- 1. REMOVER POLÍTICAS ABERTAS DE TEAM LEAD
DROP POLICY IF EXISTS "Team leads can view their agents events" ON calendar_events;
DROP POLICY IF EXISTS "Team leads can view their agents tasks" ON tasks;
DROP POLICY IF EXISTS "Team leads can view their agents interactions" ON interactions;

-- 2. CORRIGIR lead_notes (CRÍTICO!)
DROP POLICY IF EXISTS "Users can view lead notes" ON lead_notes;

CREATE POLICY "Users can view their own lead notes"
ON lead_notes FOR SELECT
TO public
USING (created_by = auth.uid());

-- 3. GARANTIR POLÍTICAS CORRETAS EM calendar_events
DROP POLICY IF EXISTS "Users can view their own events" ON calendar_events;

CREATE POLICY "Users can view their own events"
ON calendar_events FOR SELECT
TO public
USING (user_id = auth.uid());

-- 4. GARANTIR POLÍTICAS CORRETAS EM tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;

CREATE POLICY "Users can view their own tasks"
ON tasks FOR SELECT
TO public
USING (user_id = auth.uid());

-- 5. GARANTIR POLÍTICAS CORRETAS EM interactions
DROP POLICY IF EXISTS "Users can view their own interactions" ON interactions;

CREATE POLICY "Users can view their own interactions"
ON interactions FOR SELECT
TO public
USING (user_id = auth.uid());