-- "followup" já é proposto como event_type pela análise automática de IA
-- (src/lib/server/leadAutoAnalysis.ts) e já tem ícone/rótulo próprios na
-- agenda (EventCard.tsx, leadEventTitle.ts), mas a constraint da BD nunca o
-- permitiu — qualquer evento de follow-up falhava a gravar, em silêncio.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260807110000_calendar_event_type_followup.sql

alter table calendar_events drop constraint if exists calendar_events_event_type_check;

alter table calendar_events add constraint calendar_events_event_type_check
  check (event_type = any (array['meeting', 'call', 'visit', 'viewing', 'other', 'task', 'deadline', 'followup']));
