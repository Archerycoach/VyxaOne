-- ============================================================================
-- INE — enriquecimento: cache multi-indicador (vendas + rendas) e histórico.
--
-- A tabela ine_price_reference passa a guardar QUALQUER indicador do INE
-- (vendas 0012234, rendas 0012571) e VÁRIOS períodos por geografia (série
-- histórica para a tendência ano-a-ano no CMA). A unicidade antiga
-- (geo, período) impedia dois indicadores na mesma célula — substitui-se por
-- (indicador, geo, período).
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260801100000_ine_enrichment.sql
-- ============================================================================

alter table public.ine_price_reference
  add column if not exists indicator text not null default '0012234';

alter table public.ine_price_reference
  drop constraint if exists ine_price_reference_geo_code_period_code_key;

create unique index if not exists uq_ine_ref_indicator_geo_period
  on public.ine_price_reference(indicator, geo_code, period_code);

create index if not exists idx_ine_ref_indicator_geo
  on public.ine_price_reference(indicator, geo_code);

notify pgrst, 'reload schema';
