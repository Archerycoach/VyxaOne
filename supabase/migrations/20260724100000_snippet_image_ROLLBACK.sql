-- ROLLBACK de 20260724100000_snippet_image.sql
alter table public.message_snippets drop column if exists image_url;
