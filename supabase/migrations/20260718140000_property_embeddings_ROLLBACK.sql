-- Rollback do matching semântico de imóveis (20260718140000_property_embeddings.sql).
--
-- Apaga os embeddings guardados. Não perde dados de negócio (os imóveis ficam
-- intactos), mas voltar atrás implica pagar de novo a geração dos embeddings.
-- A extensão vector NÃO é removida — é usada pelo lead_memory.

drop function if exists match_properties(uuid, vector, vector, int, float);

drop policy if exists "select own property embeddings" on public.property_embeddings;
drop policy if exists "insert own property embeddings" on public.property_embeddings;
drop policy if exists "update own property embeddings" on public.property_embeddings;

drop index if exists idx_property_embeddings_user;
drop index if exists idx_property_embeddings_vec;
drop index if exists idx_property_embeddings_vec_google;

drop table if exists public.property_embeddings;
