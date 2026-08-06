-- Reverte 20260805180000_meta_conversions_api.sql.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805180000_meta_conversions_api_ROLLBACK.sql

alter table meta_integrations
  drop column if exists capi_dataset_id,
  drop column if exists capi_access_token;

alter table meta_webhook_logs
  drop column if exists capi_status,
  drop column if exists capi_error;

notify pgrst, 'reload schema';
