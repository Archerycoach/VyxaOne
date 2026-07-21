-- ROLLBACK de 20260721140000_location_insights_cache.sql
-- Apaga apenas cache de dados públicos do OpenStreetMap — sem perda real.

drop policy if exists "location_insights_cache_select" on public.location_insights_cache;
drop index if exists idx_location_insights_cache_key;
drop table if exists public.location_insights_cache;
