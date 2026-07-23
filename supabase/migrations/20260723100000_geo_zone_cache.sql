-- ============================================================
-- Cache de coordenadas por zona (texto livre → lat/lon)
--
-- Os emails por procura passam a usar geolocalização: "Arroios" a 1 km de
-- "Penha de França" é um match próximo, mesmo sem partilhar uma palavra.
-- Cada zona distinta é geocodificada UMA vez (Geoapify) e fica aqui — a
-- quota gratuita chega folgadamente porque as zonas repetem-se muito.
--
-- Dados públicos (nomes de zonas e coordenadas), sem informação de clientes.
-- Idempotente.
-- ============================================================

create table if not exists public.geo_zone_cache (
  zone_norm text primary key,
  zone_text text,
  lat double precision,
  lon double precision,
  -- Zonas que falharam a geocodificação também ficam registadas (lat/lon
  -- null) para não voltarem a gastar chamadas.
  fetched_at timestamptz not null default now()
);

alter table public.geo_zone_cache enable row level security;

drop policy if exists "geo_zone_cache_select" on public.geo_zone_cache;
create policy "geo_zone_cache_select"
  on public.geo_zone_cache for select
  using (auth.uid() is not null);
