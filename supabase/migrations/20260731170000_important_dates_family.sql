-- ============================================================================
-- Datas importantes + dados de família em leads E contactos, para felicitações
-- automáticas (aniversários próprios/família, aniversário de casamento, datas
-- personalizadas). Uniformiza os campos entre as duas entidades.
--
-- Estrutura:
--   important_dates jsonb  = [{ "label": "...", "date": "YYYY-MM-DD", "recurring": true }]
--   family jsonb           = {
--       "spouse_name": "...", "spouse_birthday": "YYYY-MM-DD",
--       "wedding_anniversary": "YYYY-MM-DD",
--       "children": [{ "name": "...", "birth_date": "YYYY-MM-DD" }]
--     }
--   important_dates_email_enabled boolean = felicitação automática ligada.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260731170000_important_dates_family.sql
-- ============================================================================

-- Leads: já têm birthday + important_dates; falta família + toggle.
alter table public.leads
  add column if not exists family jsonb default '{}'::jsonb,
  add column if not exists important_dates_email_enabled boolean default false;

-- Contactos: têm birth_date; falta important_dates + família + toggle.
alter table public.contacts
  add column if not exists important_dates jsonb default '[]'::jsonb,
  add column if not exists family jsonb default '{}'::jsonb,
  add column if not exists important_dates_email_enabled boolean default false;

-- Evita felicitar duas vezes a mesma ocasião no mesmo ano: regista o último ano
-- em que se enviou por entidade+ocasião (o cron consulta antes de enviar).
create table if not exists public.important_date_sent_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  entity_type  text not null,           -- 'lead' | 'contact'
  entity_id    uuid not null,
  occasion_key text not null,           -- ex.: 'birthday', 'spouse_birthday', 'child:2', 'custom:<label>'
  sent_year    integer not null,
  sent_at      timestamptz default now(),
  unique (entity_type, entity_id, occasion_key, sent_year)
);
create index if not exists idx_important_date_sent_user on public.important_date_sent_log(user_id);

notify pgrst, 'reload schema';
