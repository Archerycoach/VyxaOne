-- ============================================================================
-- Perfil do consultor (identidade) — o que a IA lê SEMPRE, em todas as chamadas.
--
-- Não confundir com a Base de Conhecimento (knowledge_docs): essa é procurada
-- por semelhança, só quando é relevante à pergunta. Isto é a identidade — quem
-- o consultor é, como fala e como trabalha — e entra em todos os prompts.
--
-- Quatro papéis fixos, curtos de propósito (vão em todos os prompts; um perfil
-- que rebenta o contexto acaba desligado):
--   identity   — quem é, mercado, zona, o que o distingue
--   voice      — como escreve: tom, tratamento, comprimento, abertura, assinatura
--   method     — como trabalha: cadência, canais, o que faz primeiro
--   boundaries — o que nunca fazer nem dizer em nome dele
--
-- Acrescentar um papel novo no futuro é um `add column if not exists`.
--
-- O perfil NUNCA se reescreve sozinho: as propostas da IA passam pela espinha
-- ai_actions (propor → confirmar → aplicar → reverter). O histórico abaixo
-- guarda o estado anterior e o motivo de cada alteração, venha de onde vier.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805140000_consultant_profile.sql
-- ============================================================================

create table if not exists public.consultant_profile (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  identity text,
  voice text,
  method text,
  boundaries text,

  -- Respostas em bruto do questionário, para se poder refazer a composição dos
  -- textos acima sem voltar a perguntar tudo.
  questionnaire jsonb not null default '{}'::jsonb,
  questionnaire_completed_at timestamptz,

  -- Desligar sem apagar: útil para perceber se um comportamento estranho da IA
  -- vem do perfil ou não.
  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultant_profile_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  slot text not null,
  old_value text,
  new_value text,

  -- Porquê e de onde veio: 'questionnaire' | 'manual' | 'ai_proposal'
  reason text,
  source text not null default 'manual',

  created_at timestamptz not null default now(),

  constraint consultant_profile_history_slot_check
    check (slot in ('identity', 'voice', 'method', 'boundaries'))
);

create index if not exists idx_consultant_profile_history_user
  on public.consultant_profile_history(user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- O perfil é do próprio e só do próprio. Ao contrário das leads, não há
-- hierarquia aqui: a identidade de um consultor não é dado de gestão. A
-- escrita é feita pelo servidor (service role) depois de autenticar o token.

alter table public.consultant_profile enable row level security;
alter table public.consultant_profile_history enable row level security;

drop policy if exists "select own consultant profile" on public.consultant_profile;
create policy "select own consultant profile" on public.consultant_profile
  for select using (user_id = auth.uid());

drop policy if exists "insert own consultant profile" on public.consultant_profile;
create policy "insert own consultant profile" on public.consultant_profile
  for insert with check (user_id = auth.uid());

drop policy if exists "update own consultant profile" on public.consultant_profile;
create policy "update own consultant profile" on public.consultant_profile
  for update using (user_id = auth.uid());

drop policy if exists "select own profile history" on public.consultant_profile_history;
create policy "select own profile history" on public.consultant_profile_history
  for select using (user_id = auth.uid());

notify pgrst, 'reload schema';
