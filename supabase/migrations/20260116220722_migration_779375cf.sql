-- ===================================
-- HIERARQUIA DE PERMISSÕES COMPLETA
-- ===================================

-- 1. CALENDAR_EVENTS - SELECT (visualização)
-- Remover política antiga
DROP POLICY IF EXISTS "Users can view their own events" ON calendar_events;

-- Criar nova política com hierarquia
CREATE POLICY "View events based on role hierarchy"
ON calendar_events FOR SELECT
TO public
USING (
  -- Admins veem tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Team Leads veem seus próprios eventos + eventos dos agentes
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND (
      user_id = auth.uid() -- Seus próprios eventos
      OR
      user_id IN ( -- Eventos dos agentes ligados a ele
        SELECT id FROM profiles 
        WHERE team_lead_id = auth.uid()
      )
    )
  )
  OR
  -- Agentes veem apenas seus próprios eventos
  (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    )
  )
);

-- ===================================
-- 2. TASKS - SELECT (visualização)
-- ===================================
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;

CREATE POLICY "View tasks based on role hierarchy"
ON tasks FOR SELECT
TO public
USING (
  -- Admins veem tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Team Leads veem suas próprias tarefas + tarefas dos agentes
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND (
      user_id = auth.uid()
      OR
      user_id IN (
        SELECT id FROM profiles 
        WHERE team_lead_id = auth.uid()
      )
    )
  )
  OR
  -- Agentes veem apenas suas próprias tarefas
  (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    )
  )
);

-- ===================================
-- 3. INTERACTIONS - SELECT (visualização)
-- ===================================
DROP POLICY IF EXISTS "Users can view their own interactions" ON interactions;

CREATE POLICY "View interactions based on role hierarchy"
ON interactions FOR SELECT
TO public
USING (
  -- Admins veem tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Team Leads veem suas próprias interações + interações dos agentes
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND (
      user_id = auth.uid()
      OR
      user_id IN (
        SELECT id FROM profiles 
        WHERE team_lead_id = auth.uid()
      )
    )
  )
  OR
  -- Agentes veem apenas suas próprias interações
  (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    )
  )
);

-- ===================================
-- 4. LEAD_NOTES - SELECT (visualização)
-- ===================================
DROP POLICY IF EXISTS "Users can view their own lead notes" ON lead_notes;

CREATE POLICY "View lead notes based on role hierarchy"
ON lead_notes FOR SELECT
TO public
USING (
  -- Admins veem tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Team Leads veem suas próprias notas + notas dos agentes
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND (
      created_by = auth.uid()
      OR
      created_by IN (
        SELECT id FROM profiles 
        WHERE team_lead_id = auth.uid()
      )
    )
  )
  OR
  -- Agentes veem apenas suas próprias notas
  (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    )
  )
);