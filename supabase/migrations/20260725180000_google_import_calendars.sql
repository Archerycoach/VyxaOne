-- Google Calendar: permitir importar eventos de VÁRIOS calendários do Google
-- (quem tem mais do que um calendário na sua conta). O calendar_id continua a
-- ser o calendário PRINCIPAL (destino das exportações Vyxa→Google); estes são
-- calendários ADICIONAIS de onde só se importa.

alter table public.google_calendar_integrations
  add column if not exists import_calendar_ids jsonb not null default '[]'::jsonb;

-- ROLLBACK:
-- alter table public.google_calendar_integrations drop column if exists import_calendar_ids;
