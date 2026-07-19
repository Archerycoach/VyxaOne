-- Resubmissão de formulários Meta por leads já existentes.
--
-- Quando alguém que já está na base volta a preencher um formulário, isso é
-- um sinal forte de intenção — mas até agora ficava só numa nota, e a lead
-- continuava enterrada na lista pela data de criação original.
--
-- last_form_submission_at  → data da última submissão (a lista usa-a para
--                            fazer a lead subir ao topo, como se fosse nova)
-- form_submissions_count   → quantas vezes preencheu formulários (1 = a
--                            entrada original; 2+ = voltou)
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.leads
  add column if not exists last_form_submission_at timestamptz;

alter table public.leads
  add column if not exists form_submissions_count integer not null default 1;

-- A lista ordena pela data efetiva (submissão mais recente, ou criação).
create index if not exists idx_leads_effective_recency
  on public.leads(user_id, last_form_submission_at desc nulls last, created_at desc);

comment on column public.leads.last_form_submission_at is
  'Última vez que a lead submeteu um formulário (Meta). Usada para a fazer subir na lista.';

comment on column public.leads.form_submissions_count is
  'Número de formulários submetidos por esta lead. 1 = entrada original.';
