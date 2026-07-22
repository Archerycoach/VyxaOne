-- ROLLBACK de 20260722100000_ine_price_reference.sql
-- Apaga apenas cache de dados públicos do INE.

drop policy if exists "ine_price_reference_select" on public.ine_price_reference;
drop index if exists idx_ine_price_reference_geo;
drop table if exists public.ine_price_reference;
