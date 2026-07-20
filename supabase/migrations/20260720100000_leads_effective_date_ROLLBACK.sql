-- Rollback da coluna de ordenação (20260720100000_leads_effective_date.sql).
--
-- Só é seguro correr isto DEPOIS de a listagem voltar a ordenar em memória —
-- sem esta coluna, a paginação no servidor deixa de conseguir ordenar e a
-- lista aparece por ordem arbitrária.
--
-- Não perde dados: a coluna é gerada a partir de last_form_submission_at e
-- created_at, que continuam intactas. Reaplicar a migração recria-a.

drop index if exists idx_leads_assigned_effective;
drop index if exists idx_leads_effective_date;

alter table public.leads drop column if exists effective_date;
