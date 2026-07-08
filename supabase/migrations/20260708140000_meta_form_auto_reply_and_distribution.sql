-- Email de resposta automática configurável por formulário/campanha da Meta
-- (em vez de depender só do workflow genérico "meta_lead_created", que é
-- por utilizador, não por formulário).
ALTER TABLE meta_form_configs
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_subject text,
  ADD COLUMN IF NOT EXISTS auto_reply_body text;

-- Modo de atribuição por formulário: "fixed" mantém o comportamento atual
-- (auto_assign_to, um único utilizador); "team_round_robin" distribui cada
-- lead nova automaticamente por quem da equipa (broker: todos os team_leads
-- e consultores; team_lead: só os seus consultores) tiver menos leads ativas
-- atribuídas no momento, para ficar equitativo sem precisar de guardar
-- nenhum ponteiro de rotação.
ALTER TABLE meta_form_configs
  ADD COLUMN IF NOT EXISTS auto_assign_mode text NOT NULL DEFAULT 'fixed';

-- Quando auto_assign_mode = 'team_round_robin', permite ao broker/team_lead
-- escolher se ele próprio entra também no conjunto de candidatos à
-- distribuição, ou se fica de fora e só a equipa recebe leads.
ALTER TABLE meta_form_configs
  ADD COLUMN IF NOT EXISTS auto_assign_include_owner boolean NOT NULL DEFAULT false;
