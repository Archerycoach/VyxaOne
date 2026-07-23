-- ROLLBACK de 20260723100000_geo_zone_cache.sql
drop policy if exists "geo_zone_cache_select" on public.geo_zone_cache;
drop table if exists public.geo_zone_cache;
