-- select_tasks_hierarchy/update_tasks_hierarchy (de 20260626201423) usam
-- can_access_record(user_id), que dá visibilidade cruzada dentro da mesma
-- equipa (pensada para leads/calendário partilhados). Para tarefas isso é
-- errado: um consultor via TODAS as tarefas pessoais do seu team lead, não
-- só as suas ou as que lhe foram atribuídas. Também faltava a verificação
-- de assigned_to (só existia para leads).
--
-- Substituído por lógica explícita, sem depender de can_access_record:
-- - o próprio (criador ou atribuído)
-- - broker/admin veem tudo
-- - team lead vê as tarefas criadas por, ou atribuídas a, membros da sua equipa

DROP POLICY IF EXISTS "select_tasks_hierarchy" ON tasks;
CREATE POLICY "select_tasks_hierarchy" ON tasks
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = assigned_to
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin'))
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'team_lead')
      AND (
        EXISTS (SELECT 1 FROM profiles o WHERE o.id = tasks.user_id AND (o.team_lead_id = auth.uid() OR o.manager_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = tasks.assigned_to AND (a.team_lead_id = auth.uid() OR a.manager_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "update_tasks_hierarchy" ON tasks;
CREATE POLICY "update_tasks_hierarchy" ON tasks
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() = assigned_to
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin'))
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'team_lead')
      AND (
        EXISTS (SELECT 1 FROM profiles o WHERE o.id = tasks.user_id AND (o.team_lead_id = auth.uid() OR o.manager_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = tasks.assigned_to AND (a.team_lead_id = auth.uid() OR a.manager_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "delete_tasks_owner_or_admin" ON tasks;
CREATE POLICY "delete_tasks_owner_or_admin" ON tasks
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin'))
  );
