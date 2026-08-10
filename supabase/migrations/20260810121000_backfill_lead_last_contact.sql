-- Backfill do last_contact_date das leads a partir do histórico de interações.
--
-- O campo só começou a ser preenchido a partir de certa altura: leads com
-- interações antigas ficaram com NULL e apareceriam sem data na coluna
-- "Último Contacto" da lista de leads.
--
-- SÓ CONTA CONTACTO MANUAL: interações automáticas (resposta automática de
-- formulários, property matcher, reativação, etc.) são excluídas — "último
-- contacto" significa contacto registado pelo consultor. O predicado espelha
-- AUTOMATED_OUTCOME_MARKERS de src/lib/leadInteractionHighlight.ts.
--
-- Idempotente: só toca em leads com last_contact_date NULL — na segunda
-- execução não há linhas a atualizar. O outcome só é preenchido se também
-- estiver vazio, para não reescrever valores registados pela app.
update leads l
set last_contact_date = i.last_date,
    last_contact_outcome = coalesce(l.last_contact_outcome, i.last_outcome)
from (
  select distinct on (lead_id)
    lead_id,
    coalesce(interaction_date, created_at) as last_date,
    outcome as last_outcome
  from interactions
  where lead_id is not null
    and not (lower(coalesce(outcome, '')) like any (array[
      '%resposta autom%', '%property matcher%', '%automátic%', '%automatic%',
      '%auto-reply%', '%reativa%'
    ]))
  order by lead_id, coalesce(interaction_date, created_at) desc
) i
where l.id = i.lead_id
  and l.last_contact_date is null;
