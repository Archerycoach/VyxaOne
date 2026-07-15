-- Adiciona a flag "IA integrada incluída" aos planos de subscrição.
--
-- Regra de negócio:
--   ai_included = true  -> o plano inclui IA integrada; a app usa a chave de IA
--                          do ADMIN/agência (org_ai_keys), nunca a do consultor.
--   ai_included = false -> o consultor tem de configurar a SUA própria chave
--                          (gpt_api_keys); não há reserva para a chave do admin.
--
-- Idempotente.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS ai_included boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscription_plans.ai_included IS
  'Se true, o plano inclui IA integrada (usa a chave de IA do admin/org). Se false, o consultor tem de configurar a sua própria chave.';
