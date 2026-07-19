-- Tempo de mercado dos anúncios de particulares.
--
-- O feed do Idealista não expõe a data de publicação, por isso guardamos
-- quando vimos cada anúncio pela primeira vez. A partir daí conseguimos dizer
-- "no mercado há pelo menos X dias" — um sinal forte para a angariação: quem
-- tem a casa parada há meses está muito mais recetivo a falar com um
-- consultor.
--
-- "pelo menos" é deliberado: um anúncio que já existia antes de o começarmos
-- a acompanhar aparece como novo à primeira vez que o vemos. A precisão
-- melhora com o uso.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

create table if not exists public.fsbo_listing_sightings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Identificador do anúncio no portal (propertyCode do Idealista).
  property_code text not null,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- Preço na primeira e na última vez que o vimos: permite detetar descidas,
  -- que são outro sinal de vendedor a ficar impaciente.
  first_price numeric,
  last_price numeric,

  primary key (user_id, property_code)
);

create index if not exists idx_fsbo_sightings_user
  on public.fsbo_listing_sightings(user_id, last_seen_at desc);

alter table public.fsbo_listing_sightings enable row level security;

-- Histórico privado de cada consultor (tal como a lista de particulares).
drop policy if exists "select own sightings" on public.fsbo_listing_sightings;
create policy "select own sightings" on public.fsbo_listing_sightings
  for select using (user_id = auth.uid());

drop policy if exists "insert own sightings" on public.fsbo_listing_sightings;
create policy "insert own sightings" on public.fsbo_listing_sightings
  for insert with check (user_id = auth.uid());

drop policy if exists "update own sightings" on public.fsbo_listing_sightings;
create policy "update own sightings" on public.fsbo_listing_sightings
  for update using (user_id = auth.uid());

comment on table public.fsbo_listing_sightings is
  'Quando cada anúncio de particular foi visto pela primeira vez, para calcular o tempo de mercado.';
