-- ROLLBACK de 20260722140000_lead_last_contact_type.sql
alter table public.leads drop column if exists last_contact_type;
