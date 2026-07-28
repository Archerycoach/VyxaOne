-- ============================================================================
-- SMTP: colunas em falta na tabela user_smtp_settings.
--
-- O diálogo de configuração SMTP (SMTPSettingsDialog + smtpService) grava também
-- os campos da cópia IMAP para a pasta "Enviados" e o reject_unauthorized, MAS
-- nunca houve migração que criasse essas colunas — só a criação original
-- (smtp_*) e o reject_unauthorized. Nas bases onde faltam, o insert/update
-- rebentava com "column ... does not exist" e o painel dizia
-- "Não foi possível guardar as configurações SMTP".
--
-- Idempotente (ADD COLUMN IF NOT EXISTS): seguro em todas as bases.
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728130000_smtp_imap_columns.sql
-- ============================================================================

ALTER TABLE public.user_smtp_settings
  ADD COLUMN IF NOT EXISTS reject_unauthorized BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS imap_host        TEXT,
  ADD COLUMN IF NOT EXISTS imap_port        INTEGER DEFAULT 993,
  ADD COLUMN IF NOT EXISTS imap_secure      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS imap_sent_folder TEXT DEFAULT 'Sent';
