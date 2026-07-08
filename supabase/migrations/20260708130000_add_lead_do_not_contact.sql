-- Duas marcações manuais e independentes que o consultor pode ativar na
-- ficha da lead:

-- 1. "Não enviar WhatsApp a esta lead" — bloqueia mensagens de WhatsApp,
--    tanto em massa como individuais/manuais.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;

-- 2. "Excluir das listas de distribuição do agente IA" — bloqueia os emails
--    automáticos de Alertas de Procura e do AI Property Matcher. Não afeta
--    quem não tiver esta marcação explicitamente ativada.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS exclude_from_ai_lists boolean NOT NULL DEFAULT false;
