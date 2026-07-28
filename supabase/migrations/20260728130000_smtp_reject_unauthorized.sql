-- ============================================================================
-- SMTP: garantir a coluna reject_unauthorized em user_smtp_settings.
--
-- O diálogo de configuração SMTP grava reject_unauthorized (verificar ou não o
-- certificado SSL). Nas bases onde essa coluna nunca foi criada, o insert/update
-- rebentava com "column ... does not exist" e o painel dizia
-- "Não foi possível guardar as configurações SMTP".
--
-- (A funcionalidade IMAP de cópia para a pasta "Enviados" foi removida do
-- produto, por isso NÃO se criam colunas imap_*; se existirem de bases antigas,
-- ficam apenas sem uso — não é preciso apagá-las.)
--
-- Idempotente (ADD COLUMN IF NOT EXISTS): seguro em todas as bases.
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728130000_smtp_reject_unauthorized.sql
-- ============================================================================

ALTER TABLE public.user_smtp_settings
  ADD COLUMN IF NOT EXISTS reject_unauthorized BOOLEAN DEFAULT true;
