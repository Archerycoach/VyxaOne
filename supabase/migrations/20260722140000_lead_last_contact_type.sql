-- ============================================================
-- Tipo da última interação, na própria lead
--
-- A lista de leads mostra a última interação e o seu desfecho de relance
-- (chamada atendida, não atendeu, email, WhatsApp...). A data e o desfecho
-- já viviam na lead (last_contact_date/last_contact_outcome); faltava o TIPO,
-- que obrigaria a uma consulta às interações por cada página da lista.
--
-- Idempotente.
-- ============================================================

alter table public.leads
  add column if not exists last_contact_type text;

comment on column public.leads.last_contact_type is
  'Tipo da última interação (call, email, whatsapp, ...). Mantido pelo código junto com last_contact_date.';

-- Retro-preenchimento a partir do histórico de interações: o tipo da mais
-- recente de cada lead.
update public.leads l
set last_contact_type = i.interaction_type
from (
  select distinct on (lead_id) lead_id, interaction_type
  from public.interactions
  where lead_id is not null
  order by lead_id, interaction_date desc nulls last
) i
where i.lead_id = l.id
  and l.last_contact_type is null;
