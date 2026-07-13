-- Opt-in: quando ativo, imóveis do consultor que correspondam ao perfil de
-- procura de uma lead são automaticamente adicionados ao Portal do Cliente
-- dessa lead (e o cliente é alertado por email). Corre num cron diário.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_portal_matches boolean NOT NULL DEFAULT false;

-- Regista o último momento em que o auto-match correu para cada lead, para
-- evitar reprocessar sempre as mesmas leads (afinação futura; não obrigatório).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS auto_match_last_run_at timestamptz;
