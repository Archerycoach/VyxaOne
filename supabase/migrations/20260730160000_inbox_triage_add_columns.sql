-- ============================================================================
-- Correção de drift: garantir TODAS as colunas do assistente de emails na
-- tabela `inbox_triage`.
--
-- Porquê: a tabela foi criada por uma versão anterior da migração (sem os
-- campos de conselho). Como o `create table if not exists` NÃO altera tabelas
-- já existentes, faltavam colunas (`advice`, `agenda_suggestion`, …) e a
-- gravação falhava com "Could not find the 'advice' column ... in the schema
-- cache". Este ALTER ... ADD COLUMN IF NOT EXISTS é idempotente e seguro
-- (colunas nuláveis / com default — não quebra linhas existentes).
--
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260730160000_inbox_triage_add_columns.sql
-- ============================================================================

alter table public.inbox_triage
  add column if not exists message_uid       bigint,
  add column if not exists from_name         text,
  add column if not exists importance        text default 'medium',
  add column if not exists reminder          text,
  add column if not exists advice            text,
  add column if not exists agenda_suggestion text,
  add column if not exists lead_id           uuid,
  add column if not exists status            text default 'new',
  add column if not exists created_at        timestamptz default now();

-- Índices e restrição de unicidade (idempotentes) — caso a tabela antiga não os
-- tivesse. O unique garante que não se repete o lembrete do mesmo email.
create unique index if not exists uq_inbox_triage_user_msg
  on public.inbox_triage(user_id, message_uid);
create index if not exists idx_inbox_triage_user_status on public.inbox_triage(user_id, status);
create index if not exists idx_inbox_triage_lead on public.inbox_triage(lead_id);

-- Recarrega a cache de esquema do PostgREST para as novas colunas ficarem
-- imediatamente disponíveis à API (evita repetir o erro de "schema cache").
notify pgrst, 'reload schema';
