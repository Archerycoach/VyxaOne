-- ============================================================================
-- Assistente de emails: aprendizagem com o histórico + estilo de resposta.
--
-- (1) sender_hash em inbox_triage — identificador PSEUDONIMIZADO do remetente
--     (hash do email, NÃO o email) para aprender por remetente sem guardar o
--     endereço (RGPD).
-- (2) inbox_sender_stats — contagem por consultor+remetente de "tratado" vs
--     "ignorado", alimentada quando o consultor age no lembrete. A triagem usa
--     isto como pista ("costuma ignorar este remetente").
-- (3) inbox_reply_style em user_smtp_settings — perfil de tom/estilo que o
--     consultor define; a IA adapta os conselhos de "como responder".
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260731100000_inbox_assistant_learning.sql
-- ============================================================================

-- (1) Hash do remetente no lembrete (pseudonimizado).
alter table public.inbox_triage
  add column if not exists sender_hash text;
create index if not exists idx_inbox_triage_sender on public.inbox_triage(user_id, sender_hash);

-- (2) Estatística de decisões por remetente (aprendizagem com as tuas ações).
create table if not exists public.inbox_sender_stats (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  sender_hash     text not null,
  handled_count   integer not null default 0,
  dismissed_count integer not null default 0,
  updated_at      timestamptz default now(),
  primary key (user_id, sender_hash)
);

alter table public.inbox_sender_stats enable row level security;

-- Leitura/escrita são server-side (service-role, ignora RLS). Mesmo assim, uma
-- policy de leitura do próprio, por consistência e caso se leia no cliente.
drop policy if exists "inbox_sender_stats_select_own" on public.inbox_sender_stats;
create policy "inbox_sender_stats_select_own" on public.inbox_sender_stats
  for select to authenticated using (user_id = auth.uid());

-- (3) Estilo/tom de resposta do consultor.
alter table public.user_smtp_settings
  add column if not exists inbox_reply_style text;

notify pgrst, 'reload schema';
