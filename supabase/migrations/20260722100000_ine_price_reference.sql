-- ============================================================
-- Cache dos valores de referência do INE
--
-- O INE publica trimestralmente o valor mediano de venda por m² de
-- alojamentos familiares, por município e freguesia, a partir de escrituras
-- reais. É a âncora que faltava: os anúncios do Idealista são preços PEDIDOS
-- e, em zonas com pouca oferta, vêm de freguesias vizinhas e de segmentos
-- diferentes do imóvel a avaliar.
--
-- Trimestral: não faz sentido consultar a API a cada avaliação.
--
-- Idempotente.
-- ============================================================

create table if not exists public.ine_price_reference (
  id uuid primary key default gen_random_uuid(),

  -- Chave: código geográfico do INE + período (ex.: "1113" + "S3T2025")
  geo_code text not null,
  period_code text not null,

  geo_name text,
  price_per_sqm numeric,

  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (geo_code, period_code)
);

create index if not exists idx_ine_price_reference_geo
  on public.ine_price_reference (geo_code, period_code);

-- Dados públicos e oficiais, sem informação de clientes.
alter table public.ine_price_reference enable row level security;

drop policy if exists "ine_price_reference_select" on public.ine_price_reference;
create policy "ine_price_reference_select"
  on public.ine_price_reference for select
  using (auth.uid() is not null);
