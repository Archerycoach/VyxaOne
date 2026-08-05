-- Reverte 20260805100000_knowledge_base.sql.
-- Apaga os documentos e os respetivos embeddings — não é recuperável.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805100000_knowledge_base_ROLLBACK.sql

drop function if exists match_knowledge(uuid, vector(1536), vector(768), int, float);

drop table if exists public.knowledge_chunks;
drop table if exists public.knowledge_docs;

notify pgrst, 'reload schema';
