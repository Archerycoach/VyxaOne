-- ============================================================================
-- Limpeza: remover tabelas de backup pontuais de leads que ficaram de correções
-- de dados antigas. Não fazem parte do schema da aplicação — só existiam numa
-- instância e criavam drift face à outra.
--
-- DESTRUTIVO mas idempotente: `drop table if exists` não falha na instância que
-- já não as tem (no-op), por isso pode correr em todas as bases em segurança.
-- Confirmado pelo operador (2026-07-30) que estes backups já não são precisos.
--
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260730170000_drop_leads_backup_tables.sql
-- ============================================================================

drop table if exists public.leads_backup_20260720;
drop table if exists public.leads_budget_backup_20260721;
drop table if exists public.leads_name_backup;
drop table if exists public.leads_prefix_backup;
