-- Ordenação e paginação eficientes da lista de leads.
--
-- A lista ordena pela "data efetiva": normalmente a data de criação, mas uma
-- lead que volta a preencher um formulário salta para o topo como se fosse
-- nova (ver 20260718220000_lead_form_resubmission.sql).
--
-- Até agora essa regra era aplicada em memória, o que obrigava a carregar
-- TODAS as leads antes de as poder ordenar — e com mais de 1000 a listagem
-- ficava truncada em silêncio. Com a paginação no servidor, a ordenação tem
-- de ser feita pela base de dados, e ordenar por uma expressão não permite
-- usar índice.
--
-- Uma coluna gerada resolve as duas coisas: é calculada automaticamente pelo
-- Postgres (nunca fica dessincronizada) e pode ser indexada.
--
-- NOTA: ordenar por "last_form_submission_at desc nulls last, created_at desc"
-- NÃO é equivalente — poria todas as leads com resubmissão acima de todas as
-- outras, independentemente das datas.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.leads
  add column if not exists effective_date timestamptz
  generated always as (coalesce(last_form_submission_at, created_at)) stored;

-- Suporta a ordenação por omissão (mais recente primeiro) e a paginação.
create index if not exists idx_leads_effective_date
  on public.leads(effective_date desc nulls last);

-- A paginação é quase sempre filtrada por visibilidade (assigned_to) e por
-- leads não arquivadas: índice composto para esse caminho.
create index if not exists idx_leads_assigned_effective
  on public.leads(assigned_to, effective_date desc nulls last)
  where archived_at is null;

comment on column public.leads.effective_date is
  'Data para ordenação da lista: a da resubmissão de formulário, ou a de criação. Gerada automaticamente.';
