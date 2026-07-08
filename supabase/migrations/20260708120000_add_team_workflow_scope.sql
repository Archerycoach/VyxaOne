-- Permite que uma regra de lead_workflow_rules se aplique a toda a equipa
-- (não só ao dono/user_id da regra), para o broker poder configurar
-- automações partilhadas para a sua equipa.
ALTER TABLE lead_workflow_rules
  ADD COLUMN IF NOT EXISTS applies_to_team boolean NOT NULL DEFAULT false;

-- Alarga a política de INSERT para o mesmo padrão já usado em UPDATE/DELETE
-- nesta tabela: além de criar para si próprio, quem tiver acesso ao registo
-- (broker/team_lead, via can_access_record) pode criar uma regra "em nome"
-- de outro utilizador da sua equipa (ex.: broker a criar uma regra para um
-- consultor específico).
DROP POLICY IF EXISTS "Users can insert own workflow rules" ON lead_workflow_rules;

CREATE POLICY "Users can insert own workflow rules" ON lead_workflow_rules
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR can_access_record(user_id)
  );
