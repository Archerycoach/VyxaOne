-- Opções da lead compradora usadas na pesquisa Idealista:
-- garagem e obra nova (empreendimento novo). Filtram os resultados.

alter table public.leads
  add column if not exists wants_garage boolean,
  add column if not exists wants_new_build boolean;

-- ROLLBACK:
-- alter table public.leads
--   drop column if exists wants_garage,
--   drop column if exists wants_new_build;
