-- Reverte 20260805160000_ai_writing_samples.sql.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805160000_ai_writing_samples_ROLLBACK.sql

drop table if exists public.ai_writing_samples;

notify pgrst, 'reload schema';
