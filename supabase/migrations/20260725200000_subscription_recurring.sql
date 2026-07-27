-- Pagamentos recorrentes: renovação automática das subscrições.
--
-- Nesta fase, "recorrente" = lembrete de renovação perto do vencimento (com
-- link para pagar) + o webhook do EuPago a estender a subscrição ao pagar. A
-- cobrança AUTOMÁTICA de cartão (tokenização) fica para quando o contrato
-- EuPago confirmar o produto de recorrência — a coluna card_token abaixo é o
-- ponto de extensão para essa fase.

alter table public.subscriptions
  add column if not exists auto_renew boolean not null default true,
  add column if not exists renewal_reminder_sent_at timestamptz,
  -- Token do cartão para cobrança automática (fase 2, EuPago tokenização).
  add column if not exists card_token text;

-- ROLLBACK:
-- alter table public.subscriptions
--   drop column if exists auto_renew,
--   drop column if exists renewal_reminder_sent_at,
--   drop column if exists card_token;
