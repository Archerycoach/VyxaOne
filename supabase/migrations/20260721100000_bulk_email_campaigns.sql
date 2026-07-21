-- ============================================================
-- Registo de campanhas de email em massa (emails por procura)
--
-- O envio em massa contava sucessos e falhas para mostrar um toast e
-- descartava tudo a seguir. Não havia forma de responder a "quantos emails
-- saíram de facto naquela campanha?" — que é a pergunta que interessa depois
-- de premir enviar.
--
-- Uma linha por campanha, com os critérios usados e o resultado real.
-- Idempotente: pode ser aplicada mais do que uma vez sem efeito.
-- ============================================================

create table if not exists public.bulk_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Conteúdo enviado
  subject text,
  channel text not null default 'email',

  -- Como a audiência foi escolhida: 'ai_search' (emails por procura),
  -- 'manual' (seleção à mão), 'filter' (filtros da página).
  audience_source text not null default 'manual',
  -- Critérios da procura (zona, tipologia, finalidade, tipo de imóvel...)
  criteria jsonb not null default '{}'::jsonb,

  -- Resultado real do envio
  recipients_total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  -- Amostra dos erros, para diagnóstico sem guardar tudo
  errors jsonb not null default '[]'::jsonb,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bulk_email_campaigns_user_created
  on public.bulk_email_campaigns (user_id, created_at desc);

alter table public.bulk_email_campaigns enable row level security;

-- Cada consultor vê e cria as suas campanhas. O broker/admin da conta vê
-- todas, em linha com a visibilidade do resto da aplicação.
drop policy if exists "bulk_email_campaigns_select" on public.bulk_email_campaigns;
create policy "bulk_email_campaigns_select"
  on public.bulk_email_campaigns for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('broker', 'admin', 'team_lead')
    )
  );

drop policy if exists "bulk_email_campaigns_insert" on public.bulk_email_campaigns;
create policy "bulk_email_campaigns_insert"
  on public.bulk_email_campaigns for insert
  with check (user_id = auth.uid());

drop policy if exists "bulk_email_campaigns_update" on public.bulk_email_campaigns;
create policy "bulk_email_campaigns_update"
  on public.bulk_email_campaigns for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
