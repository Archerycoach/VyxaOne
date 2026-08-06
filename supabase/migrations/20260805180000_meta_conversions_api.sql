-- ============================================================================
-- Conversions API para Lead Ads (Meta) — envia de volta à Meta a confirmação
-- de que um lead foi recebido, com email/telefone com hash. Não é preciso
-- para os leads continuarem a chegar (isso já funciona); é o que a Meta usa
-- para otimizar a entrega dos anúncios com base em leads reais.
--
-- Por consultor, tal como a Página já é (meta_integrations é 1 linha por
-- utilizador+página) — cada consultor liga a sua própria Business Manager.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805180000_meta_conversions_api.sql
-- ============================================================================

alter table meta_integrations
  add column if not exists capi_dataset_id text,
  add column if not exists capi_access_token text;

-- Auditoria por lead: já existe meta_webhook_logs (1 linha por leadgen_id),
-- só acrescenta o resultado do envio à Conversions API — 'not_configured' |
-- 'sent' | 'failed'. Sem isto, uma falha silenciosa (token expirado, dataset
-- errado) nunca seria detetada pelo consultor.
alter table meta_webhook_logs
  add column if not exists capi_status text,
  add column if not exists capi_error text;

notify pgrst, 'reload schema';
