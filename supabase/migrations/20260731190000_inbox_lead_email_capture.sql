-- ============================================================================
-- Assistente de emails: captura de emails de LEADS conhecidas.
--
-- Decisão do operador (2026-07-31, altera a minimização inicial): emails
-- recebidos de LEADS passam a ser guardados — registados como interação na
-- ficha da lead (cópia do texto) e visíveis no assistente ("Ver email").
-- Para remetentes desconhecidos mantém-se tudo como estava (não se guarda).
--
-- 1) email_subject/email_body em inbox_triage — só preenchidos para leads.
-- 2) inbox_email_log — marcador de dedupe por email (uid) para o registo da
--    interação e do evento de agenda não se repetirem quando o "Verificar
--    agora" re-analisa a mesma janela de dias.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260731190000_inbox_lead_email_capture.sql
-- ============================================================================

alter table public.inbox_triage
  add column if not exists email_subject text,
  add column if not exists email_body    text;

create table if not exists public.inbox_email_log (
  user_id     uuid   not null,
  message_uid bigint not null,
  created_at  timestamptz default now(),
  primary key (user_id, message_uid)
);

alter table public.inbox_email_log enable row level security;
-- Escrita/leitura só pelo servidor (service_role ignora RLS); sem policies.

notify pgrst, 'reload schema';
