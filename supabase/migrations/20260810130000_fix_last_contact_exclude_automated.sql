-- Correção: o backfill de 20260810121000 (versão original) propagou interações
-- AUTOMÁTICAS (resposta automática de formulários, property matcher, etc.)
-- para o last_contact_* das leads — a coluna "Último Contacto" mostrava a data
-- de criação da lead só porque a resposta automática saiu nesse momento.
--
-- "Último contacto" significa contacto registado pelo consultor. Esta migração
-- repõe isso: nas leads cujo último contacto registado é automático, volta a
-- calcular a partir da última interação MANUAL; se não houver nenhuma, limpa.
--
-- O predicado de "automático" espelha AUTOMATED_OUTCOME_MARKERS de
-- src/lib/leadInteractionHighlight.ts.
--
-- Idempotente: depois de correr, nenhuma lead fica com outcome automático no
-- last_contact_outcome — repetir não encontra linhas para tocar.

-- 1) Leads com último contacto automático MAS com contactos manuais no
--    histórico: repor o mais recente dos manuais.
update leads l
set last_contact_date = m.last_date,
    last_contact_type = m.last_type,
    last_contact_outcome = m.last_outcome
from (
  select distinct on (i.lead_id)
    i.lead_id,
    coalesce(i.interaction_date, i.created_at) as last_date,
    i.interaction_type as last_type,
    i.outcome as last_outcome
  from interactions i
  where not (lower(coalesce(i.outcome, '')) like any (array[
    '%resposta autom%', '%property matcher%', '%automátic%', '%automatic%',
    '%auto-reply%', '%reativa%'
  ]))
  order by i.lead_id, coalesce(i.interaction_date, i.created_at) desc
) m
where l.id = m.lead_id
  and lower(coalesce(l.last_contact_outcome, '')) like any (array[
    '%resposta autom%', '%property matcher%', '%automátic%', '%automatic%',
    '%auto-reply%', '%reativa%'
  ]);

-- 2) Leads com último contacto automático e SEM nenhum contacto manual no
--    histórico: limpar os campos — nunca foram contactadas pelo consultor.
update leads l
set last_contact_date = null,
    last_contact_type = null,
    last_contact_outcome = null
where lower(coalesce(l.last_contact_outcome, '')) like any (array[
    '%resposta autom%', '%property matcher%', '%automátic%', '%automatic%',
    '%auto-reply%', '%reativa%'
  ])
  and not exists (
    select 1 from interactions i
    where i.lead_id = l.id
      and not (lower(coalesce(i.outcome, '')) like any (array[
        '%resposta autom%', '%property matcher%', '%automátic%', '%automatic%',
        '%auto-reply%', '%reativa%'
      ]))
  );
