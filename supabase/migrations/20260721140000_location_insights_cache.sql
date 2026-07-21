-- ============================================================
-- Cache dos pontos de interesse por localização
--
-- Os pontos de interesse vêm do Overpass (OpenStreetMap), que é gratuito e
-- sem chave mas limita pedidos repetidos do mesmo IP: medido na prática, as
-- duas primeiras chamadas seguidas respondem e as seguintes vêm vazias.
--
-- Sem cache, gerar duas avaliações seguidas produzia um documento completo e
-- outro sem a página da envolvente, sem razão aparente para quem o gera.
--
-- A chave é a coordenada arredondada a 3 casas decimais (~110 m): imóveis na
-- mesma rua partilham a mesma envolvente, que é exatamente o que se quer.
-- Escolas e paragens não mudam de mês para mês, daí a validade longa.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem efeito.
-- ============================================================

create table if not exists public.location_insights_cache (
  id uuid primary key default gen_random_uuid(),

  -- Coordenada arredondada, no formato "38.875,-9.054"
  location_key text not null unique,

  lat double precision not null,
  lon double precision not null,

  -- Lista de pontos de interesse já normalizada (nome, categoria, minutos)
  pois jsonb not null default '[]'::jsonb,

  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_location_insights_cache_key
  on public.location_insights_cache (location_key);

-- Cache partilhado: não contém dados de clientes, apenas informação pública
-- do OpenStreetMap. Escrita só pela service role (o servidor).
alter table public.location_insights_cache enable row level security;

drop policy if exists "location_insights_cache_select" on public.location_insights_cache;
create policy "location_insights_cache_select"
  on public.location_insights_cache for select
  using (auth.uid() is not null);
