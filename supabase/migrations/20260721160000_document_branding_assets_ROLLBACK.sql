-- ROLLBACK de 20260721160000_document_branding_assets.sql
-- Os ficheiros no storage não são apagados — só as referências.

alter table public.profiles
  drop column if exists document_cover_pdf_path,
  drop column if exists document_about_pdf_path,
  drop column if exists document_closing_pdf_path,
  drop column if exists document_footer_image_path,
  drop column if exists document_brand_color,
  drop column if exists document_accent_color;
