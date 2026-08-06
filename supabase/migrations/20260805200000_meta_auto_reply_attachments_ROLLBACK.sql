-- Reverte 20260805200000_meta_auto_reply_attachments.sql.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805200000_meta_auto_reply_attachments_ROLLBACK.sql

alter table meta_form_configs
  drop column if exists auto_reply_attachments;

notify pgrst, 'reload schema';
