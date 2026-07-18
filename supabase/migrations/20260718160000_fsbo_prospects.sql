-- Assistente FSBO (particulares a vender).
--
-- Caderno de angariação do consultor: ele encontra o anúncio (no Idealista,
-- OLX, Facebook, onde for), cola aqui, e a aplicação organiza — extrai os
-- dados do imóvel e cruza com a carteira de compradores dele.
--
-- A aplicação NUNCA contacta o proprietário nem envia nada: o contacto é
-- sempre feito pelo consultor, como faria depois de uma busca no portal.
-- Isto é um bloco de notas estruturado, não uma ferramenta de prospeção
-- automatizada.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

create table if not exists public.fsbo_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Origem (o anúncio que o consultor encontrou).
  source_url text,
  source text,                          -- 'idealista' | 'olx' | 'facebook' | 'outro'

  -- Dados do imóvel.
  title text,
  description text,
  property_type text,
  typology text,
  price numeric,
  area numeric,
  bedrooms int,
  bathrooms int,
  address text,
  city text,
  district text,
  energy_rating text,

  -- Contacto que consta do anúncio (preenchido pelo consultor).
  owner_name text,
  owner_phone text,

  -- Acompanhamento da angariação.
  -- novo | contactado | sem_interesse | angariado | descartado
  status text not null default 'novo',
  notes text,
  contacted_at timestamptz,

  -- Nº de compradores da carteira com afinidade (calculado ao cruzar).
  matched_buyers int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fsbo_prospects_user
  on public.fsbo_prospects(user_id, status, created_at desc);

create unique index if not exists idx_fsbo_prospects_url
  on public.fsbo_prospects(user_id, source_url)
  where source_url is not null;

alter table public.fsbo_prospects enable row level security;

-- Estritamente privado ao consultor que o registou: é o caderno dele.
-- Sem partilha por can_access_record, ao contrário das leads.
drop policy if exists "select own fsbo" on public.fsbo_prospects;
create policy "select own fsbo" on public.fsbo_prospects
  for select using (user_id = auth.uid());

drop policy if exists "insert own fsbo" on public.fsbo_prospects;
create policy "insert own fsbo" on public.fsbo_prospects
  for insert with check (user_id = auth.uid());

drop policy if exists "update own fsbo" on public.fsbo_prospects;
create policy "update own fsbo" on public.fsbo_prospects
  for update using (user_id = auth.uid());

drop policy if exists "delete own fsbo" on public.fsbo_prospects;
create policy "delete own fsbo" on public.fsbo_prospects
  for delete using (user_id = auth.uid());
