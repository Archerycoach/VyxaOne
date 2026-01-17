-- ===================================
-- OPÇÃO A: ISOLAMENTO TOTAL
-- Remover políticas de Team Lead
-- ===================================

-- 1. Remover política de Team Lead de calendar_events
DROP POLICY IF EXISTS "Team leads can view their agents events" ON calendar_events;

-- 2. Remover política de Team Lead de tasks
DROP POLICY IF EXISTS "Team leads can view their agents tasks" ON tasks;

-- 3. Remover política de Team Lead de interactions
DROP POLICY IF EXISTS "Team leads can view their agents interactions" ON interactions;