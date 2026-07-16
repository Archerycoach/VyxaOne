-- Buyer Match 2.0
--
-- 1. development_typologies — características por tipologia de cada
--    empreendimento (T0-T6+, preço/área de-até, unidades).
-- 2. developments — condições de pagamento/reserva e amenities.
-- 3. buyer_matches — histórico/dedupe dos matches lead ↔ imóvel/empreendimento
--    (evita alertar/enviar duas vezes a mesma sugestão).
-- 4. profiles — toggles: buyer_match_enabled (alertas, ligado por defeito) e
--    buyer_match_email_enabled (email automático ao cliente, desligado).
--
-- Idempotente: pode correr em qualquer base, quantas vezes for preciso.

-- ============================================================
-- 1. Tipologias por empreendimento
-- ============================================================
create table if not exists public.development_typologies (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  typology text not null,
  price_from numeric,
  price_to numeric,
  area_from numeric,
  area_to numeric,
  units_total integer,
  units_available integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_development_typologies_development
  on public.development_typologies (development_id);

alter table public.development_typologies enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'development_typologies' and policyname = 'select_own_development_typologies') then
    create policy "select_own_development_typologies" on public.development_typologies for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'development_typologies' and policyname = 'insert_own_development_typologies') then
    create policy "insert_own_development_typologies" on public.development_typologies for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'development_typologies' and policyname = 'update_own_development_typologies') then
    create policy "update_own_development_typologies" on public.development_typologies for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'development_typologies' and policyname = 'delete_own_development_typologies') then
    create policy "delete_own_development_typologies" on public.development_typologies for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 2. Campos novos nos empreendimentos
-- ============================================================
alter table public.developments
  add column if not exists payment_terms text;

alter table public.developments
  add column if not exists reservation_terms text;

alter table public.developments
  add column if not exists amenities text[];

-- ============================================================
-- 3. Histórico/dedupe de buyer matches
-- ============================================================
create table if not exists public.buyer_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  development_id uuid references public.developments(id) on delete cascade,
  typology text,
  score integer not null default 0,
  reasons text[],
  status text not null default 'new', -- new | emailed | dismissed
  created_at timestamptz not null default now()
);

-- Dedupe: cada par lead↔imóvel e lead↔empreendimento só é registado uma vez.
create unique index if not exists uq_buyer_matches_lead_property
  on public.buyer_matches (lead_id, property_id)
  where property_id is not null;

create unique index if not exists uq_buyer_matches_lead_development
  on public.buyer_matches (lead_id, development_id)
  where development_id is not null;

create index if not exists idx_buyer_matches_user_created
  on public.buyer_matches (user_id, created_at desc);

alter table public.buyer_matches enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buyer_matches' and policyname = 'select_own_buyer_matches') then
    create policy "select_own_buyer_matches" on public.buyer_matches for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buyer_matches' and policyname = 'insert_own_buyer_matches') then
    create policy "insert_own_buyer_matches" on public.buyer_matches for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buyer_matches' and policyname = 'update_own_buyer_matches') then
    create policy "update_own_buyer_matches" on public.buyer_matches for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buyer_matches' and policyname = 'delete_own_buyer_matches') then
    create policy "delete_own_buyer_matches" on public.buyer_matches for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 4. Toggles por consultor
-- ============================================================
alter table public.profiles
  add column if not exists buyer_match_enabled boolean not null default true;

alter table public.profiles
  add column if not exists buyer_match_email_enabled boolean not null default false;
