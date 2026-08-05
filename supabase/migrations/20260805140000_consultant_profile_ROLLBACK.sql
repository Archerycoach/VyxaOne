-- Reverte 20260805140000_consultant_profile.sql.
-- Apaga os perfis e o histórico — não é recuperável.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805140000_consultant_profile_ROLLBACK.sql

drop table if exists public.consultant_profile_history;
drop table if exists public.consultant_profile;

notify pgrst, 'reload schema';
