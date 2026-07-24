-- Rollback do envio em massa em segundo plano.
drop table if exists public.bulk_email_queue;

alter table public.bulk_email_campaigns
  drop column if exists body_html,
  drop column if exists attachments,
  drop column if exists copy_to_email,
  drop column if exists copy_sent,
  drop column if exists status;
