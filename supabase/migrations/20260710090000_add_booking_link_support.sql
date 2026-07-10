-- Link público de agendamento: o consultor marca blocos de 30 min na sua
-- agenda como "disponíveis para reserva"; o cliente reserva um sozinho
-- através de um link pessoal do consultor (mesmo padrão do portal_token
-- já usado no Portal do Cliente, ver leads.portal_token).
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS is_bookable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calendar_events_bookable ON calendar_events(user_id, is_bookable, start_time)
  WHERE is_bookable = true;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS booking_token text UNIQUE;
