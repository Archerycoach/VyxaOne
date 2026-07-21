-- Rollback do perfil de apresentação em documentos.
--
-- ATENÇÃO: apaga os textos de apresentação escritos pelos consultores. Se o
-- objetivo for apenas deixar de os mostrar, basta esvaziar os campos na
-- interface — este rollback destrói o conteúdo.

alter table public.profiles drop column if exists document_cover_title;
alter table public.profiles drop column if exists document_about_me;
alter table public.profiles drop column if exists document_closing_text;
alter table public.profiles drop column if exists ami_license;
