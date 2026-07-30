-- ============================================================================
-- Assistente de emails: lê a caixa do consultor (IMAP, só leitura) e a IA gera
-- LEMBRETES e CONSELHOS (agenda + como responder). NÃO guarda os emails.
--
-- RGPD: o conteúdo dos emails é lido e analisado em memória e DESCARTADO. O que
-- se persiste é apenas o LEMBRETE/CONSELHO derivado (texto do assistente) — não
-- o assunto, remetente-email nem o corpo. É a caixa do próprio consultor.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260730100000_inbox_assistant.sql
-- ============================================================================

-- 1) Config IMAP na tabela de SMTP (reutiliza utilizador/password já lá; o IMAP
--    da RE/MAX aceita basic-auth). imap_last_uid = cursor por consultor.
alter table public.user_smtp_settings
  add column if not exists imap_host               text,
  add column if not exists imap_port               integer default 993,
  add column if not exists email_assistant_enabled boolean default false,
  add column if not exists imap_last_uid           bigint  default 0,
  -- Endereços/domínios a IGNORAR sempre (o consultor gere na página do
  -- assistente). Ex.: 'newsletter@x.pt', '@promo.pt'. Só se lê a INBOX — as
  -- pastas de Spam/Lixo nunca são tocadas.
  add column if not exists email_ignore_senders    text[]  default '{}';

-- 2) LEMBRETES/CONSELHOS gerados a partir da caixa — NÃO os emails. Guarda-se o
--    output do assistente (o que fazer, conselho de agenda, como responder), o
--    "de quem" (nome, para contexto) e a ligação à lead. Sem assunto/corpo.
create table if not exists public.inbox_triage (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  message_uid        bigint not null,    -- só para não repetir o lembrete do mesmo email
  from_name          text,               -- de quem (contexto), não o email
  importance         text default 'medium', -- high | medium | low
  reminder           text,               -- o que precisa de atenção
  advice             text,               -- como tratar / responder
  agenda_suggestion  text,               -- conselho de agenda (ligar, marcar visita…)
  lead_id            uuid references public.leads(id) on delete set null,
  status             text default 'new', -- new | handled | dismissed
  created_at         timestamptz default now(),
  unique (user_id, message_uid)
);

create index if not exists idx_inbox_triage_user_status on public.inbox_triage(user_id, status);
create index if not exists idx_inbox_triage_lead on public.inbox_triage(lead_id);

alter table public.inbox_triage enable row level security;

drop policy if exists "inbox_triage_select_own" on public.inbox_triage;
create policy "inbox_triage_select_own" on public.inbox_triage
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "inbox_triage_update_own" on public.inbox_triage;
create policy "inbox_triage_update_own" on public.inbox_triage
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "inbox_triage_delete_own" on public.inbox_triage;
create policy "inbox_triage_delete_own" on public.inbox_triage
  for delete to authenticated using (user_id = auth.uid());

-- A inserção é feita pelo cron (service_role, ignora RLS); os consultores não
-- inserem à mão, por isso não há policy de INSERT para authenticated.
