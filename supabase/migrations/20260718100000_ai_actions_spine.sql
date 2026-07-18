-- Espinha de ações da IA: proposta → aprovação → execução → registo.
--
-- 1. ai_actions — toda a ação que a IA quer fazer passa a ficar registada aqui,
--    com o estado anterior (para poder reverter), o motivo e a origem. Serve
--    ao mesmo tempo de fila de aprovação e de histórico auditável.
-- 2. profiles.ai_capability_levels — nível por capacidade, escolhido pelo
--    consultor: 'off' | 'propose' | 'auto'. Fica em jsonb para se poderem
--    acrescentar capacidades sem nova migração. Os valores por omissão são
--    resolvidos no código (ver src/lib/server/aiActions.ts), por isso um
--    objeto vazio significa "usar os defaults".
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Que capacidade gerou a ação (ex.: 'lead_temperature', 'task_create').
  capability text not null,

  -- pending | approved | rejected | auto_applied | failed | reverted
  status text not null default 'pending',

  -- Alvo da ação.
  entity_type text not null,           -- 'lead' | 'task' | 'calendar_event'
  entity_id uuid,
  lead_id uuid references public.leads(id) on delete cascade,

  -- Para o consultor perceber o que vai acontecer e porquê.
  title text not null,
  reason text,
  source text,                         -- o que despoletou (nota, interação, cron)

  payload jsonb not null default '{}'::jsonb,   -- o que aplicar
  previous_state jsonb,                          -- estado anterior (reverter)
  result jsonb,                                  -- ids criados, etc.
  error text,

  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  applied_at timestamptz,
  reverted_at timestamptz
);

create index if not exists idx_ai_actions_user_status
  on public.ai_actions(user_id, status, created_at desc);

create index if not exists idx_ai_actions_lead
  on public.ai_actions(lead_id, created_at desc);

create index if not exists idx_ai_actions_entity
  on public.ai_actions(entity_type, entity_id);

alter table public.ai_actions enable row level security;

-- O consultor vê e decide sobre as suas próprias ações; quem tem acesso ao
-- registo (gestor/broker) também vê, pela mesma regra usada nas leads.
drop policy if exists "select own ai actions" on public.ai_actions;
create policy "select own ai actions" on public.ai_actions
  for select using (
    user_id = auth.uid() or can_access_record(user_id)
  );

drop policy if exists "update own ai actions" on public.ai_actions;
create policy "update own ai actions" on public.ai_actions
  for update using (
    user_id = auth.uid() or can_access_record(user_id)
  );

-- As inserções são feitas pelo servidor (service role), que ignora RLS.
-- Mantemos uma policy restrita para o caso de inserção autenticada.
drop policy if exists "insert own ai actions" on public.ai_actions;
create policy "insert own ai actions" on public.ai_actions
  for insert with check (user_id = auth.uid());

-- Níveis por capacidade (vazio = usar os defaults do código).
alter table public.profiles
  add column if not exists ai_capability_levels jsonb not null default '{}'::jsonb;
