-- Situação de crédito do comprador — mais granular do que needs_financing
-- (boolean). Texto livre, mesmo padrão de buy_purpose/purchase_timeline:
-- valores canónicos 'pre_approved' | 'will_arrange' | 'evaluating', mas
-- aceita qualquer texto (um mapeamento Meta explícito pode gravar a resposta
-- em bruto — a UI mostra o texto tal como veio quando não reconhece o valor).
--
-- needs_financing mantém-se (é o que já alimenta filtros, IA e exportações);
-- financing_status é o detalhe mostrado na ficha, não o substitui.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805220000_lead_financing_status.sql

alter table leads
  add column if not exists financing_status text;

comment on column leads.financing_status is
  'Situação de crédito do comprador: pre_approved | will_arrange | evaluating (ou texto livre de um mapeamento Meta explícito).';

notify pgrst, 'reload schema';
