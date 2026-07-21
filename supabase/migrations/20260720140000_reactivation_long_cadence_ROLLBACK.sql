-- Rollback da cadência longa de reativação.
--
-- Não perde leads nem emails enviados — apenas o registo de que ângulos já
-- foram usados e quando está prevista a próxima tentativa. Correr isto com a
-- cadência longa ainda ativa faria a IA repetir ângulos.

drop index if exists idx_leads_reactivation_next;

alter table public.leads drop column if exists reactivation_emails_sent;
alter table public.leads drop column if exists reactivation_angles_used;
alter table public.leads drop column if exists reactivation_next_at;
alter table public.leads drop column if exists reactivation_started_at;
