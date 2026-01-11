-- ============================================
-- POLÍTICAS RLS PARA TEAM LEADS VEREM DADOS DOS SEUS AGENTES
-- ============================================

-- CONTACTS: Team leads podem ver contactos dos seus agentes
CREATE POLICY "Team leads can view their agents contacts"
ON contacts FOR SELECT
USING (
  -- User is admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR
  -- User is team lead of contact owner
  user_id IN (
    SELECT id FROM profiles
    WHERE team_lead_id = auth.uid()
  )
);

-- CALENDAR_EVENTS: Team leads podem ver eventos dos seus agentes
CREATE POLICY "Team leads can view their agents events"
ON calendar_events FOR SELECT
USING (
  -- User is admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR
  -- User is team lead of event owner
  user_id IN (
    SELECT id FROM profiles
    WHERE team_lead_id = auth.uid()
  )
);

-- TASKS: Team leads podem ver tarefas dos seus agentes
CREATE POLICY "Team leads can view their agents tasks"
ON tasks FOR SELECT
USING (
  -- User is admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR
  -- User is team lead of task assignee
  assigned_to IN (
    SELECT id FROM profiles
    WHERE team_lead_id = auth.uid()
  )
);

-- INTERACTIONS: Team leads podem ver interações dos seus agentes
CREATE POLICY "Team leads can view their agents interactions"
ON interactions FOR SELECT
USING (
  -- User is admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR
  -- User is team lead of interaction owner
  user_id IN (
    SELECT id FROM profiles
    WHERE team_lead_id = auth.uid()
  )
);

-- LEADS: Já existe política, mas vou verificar se está correta
-- A política existente permite que team leads vejam leads dos seus agentes
-- através de assigned_agent_id ou team_lead_id

-- NOTA: As políticas FOR INSERT, UPDATE, DELETE mantêm-se apenas para o próprio utilizador
-- Team leads podem VER mas não podem MODIFICAR dados dos seus agentes (exceto leads)