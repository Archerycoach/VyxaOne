-- ============================================================================
-- Agenda: marcar EVENTOS como feitos.
--
-- As tarefas já têm status "completed"; os eventos não tinham conceito de
-- "feito". `completed_at` regista quando o consultor marca o evento como
-- realizado (✓ no cartão da Agenda) — visual (riscado/esbatido) e reversível.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260801120000_calendar_event_completed.sql
-- ============================================================================

alter table public.calendar_events
  add column if not exists completed_at timestamptz;

notify pgrst, 'reload schema';
