-- Anexos no email de resposta automática dos formulários Meta — mesmo formato
-- já usado nas automações de workflow (workflow_templates/lead_workflow_rules):
-- array de {name, url}, ficheiro em Supabase Storage (bucket email_attachments).
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805200000_meta_auto_reply_attachments.sql

alter table meta_form_configs
  add column if not exists auto_reply_attachments jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
