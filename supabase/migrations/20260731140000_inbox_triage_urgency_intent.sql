-- ============================================================================
-- Assistente de emails — precisão: rubrica de urgência (1–5) + intenção.
--
-- A IA passa a devolver um score de urgência (1–5) e a INTENÇÃO do email
-- (visita, proposta, pergunta, documento, agendamento, negociação, nova_lead,
-- outro). Guarda-se para calibrar o que aparece e mostrar etiquetas na UI.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260731140000_inbox_triage_urgency_intent.sql
-- ============================================================================

alter table public.inbox_triage
  add column if not exists urgency integer,   -- 1..5 (5 = ação imediata)
  add column if not exists intent  text,      -- visita | proposta | pergunta | ...
  add column if not exists sender_kind text;  -- lead | contact | portal | unknown

notify pgrst, 'reload schema';
