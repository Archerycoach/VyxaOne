-- ROLLBACK de 20260721100000_bulk_email_campaigns.sql
-- Apaga o histórico de campanhas. Não há forma de o reconstruir.

drop policy if exists "bulk_email_campaigns_select" on public.bulk_email_campaigns;
drop policy if exists "bulk_email_campaigns_insert" on public.bulk_email_campaigns;
drop policy if exists "bulk_email_campaigns_update" on public.bulk_email_campaigns;

drop index if exists idx_bulk_email_campaigns_user_created;

drop table if exists public.bulk_email_campaigns;
