-- Reverte 20260805220000_lead_financing_status.sql.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805220000_lead_financing_status_ROLLBACK.sql

alter table leads
  drop column if exists financing_status;

notify pgrst, 'reload schema';
