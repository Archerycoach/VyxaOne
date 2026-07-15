-- Lista de instâncias-peer para o fan-out do webhook Meta, gerível no painel de
-- admin (sem redeploy). URLs separados por vírgula (ex.:
-- "https://crm.vyxa.pt/api/meta/webhook,https://abc.vyxa.pt/api/meta/webhook").
-- Só a instância de ENTRADA (para onde a Meta aponta) precisa de a preencher.
-- Idempotente.

ALTER TABLE public.meta_app_settings
  ADD COLUMN IF NOT EXISTS webhook_peers text;

COMMENT ON COLUMN public.meta_app_settings.webhook_peers IS
  'Fan-out multi-instância: URLs (separados por vírgula) das outras instâncias para onde reencaminhar o webhook Meta. Fallback: env META_WEBHOOK_PEERS.';
