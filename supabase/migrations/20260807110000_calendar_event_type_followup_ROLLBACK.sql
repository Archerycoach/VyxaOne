-- Reverte 20260807110000_calendar_event_type_followup.sql.
-- ATENÇÃO: se já existirem eventos com event_type='followup' na BD, esta
-- reversão falha (violaria a constraint restaurada) — apagar/migrar esses
-- eventos primeiro.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260807110000_calendar_event_type_followup_ROLLBACK.sql

alter table calendar_events drop constraint if exists calendar_events_event_type_check;

alter table calendar_events add constraint calendar_events_event_type_check
  check (event_type = any (array['meeting', 'call', 'visit', 'viewing', 'other', 'task', 'deadline']));
