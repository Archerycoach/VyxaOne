-- Notificações push (PWA): guarda as subscrições Web Push de cada consultor.
-- Um consultor pode ter várias (telemóvel, browser do PC, etc.).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Cada utilizador só vê/gere as suas subscrições (rede de segurança; a app
-- escreve via endpoint com service role depois de validar o token).
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ROLLBACK:
-- drop table if exists public.push_subscriptions cascade;
