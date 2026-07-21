-- ============================================================
-- Capa, contracapa e rodapé personalizados nos documentos
--
-- Até aqui a capa e a folha de fecho eram desenhadas pela aplicação a partir
-- dos textos escritos nas Definições. Isso serve para quem não tem material
-- gráfico, mas um consultor com identidade da agência quer entregar a SUA
-- capa — feita no Canva, no InDesign ou fornecida pela rede.
--
-- Guardam-se os caminhos no storage (bucket "documents"), não os ficheiros.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem efeito.
-- ============================================================

alter table public.profiles
  add column if not exists document_cover_pdf_path text,
  add column if not exists document_about_pdf_path text,
  add column if not exists document_closing_pdf_path text,
  add column if not exists document_footer_image_path text,
  add column if not exists document_brand_color text,
  add column if not exists document_accent_color text;

comment on column public.profiles.document_cover_pdf_path is
  'PDF que substitui a capa gerada. Todas as páginas são usadas.';
comment on column public.profiles.document_about_pdf_path is
  'PDF que substitui a folha de apresentação do consultor. Entra a seguir à capa.';
comment on column public.profiles.document_closing_pdf_path is
  'PDF acrescentado no fim, depois da folha de fecho.';
comment on column public.profiles.document_footer_image_path is
  'Imagem (PNG/JPG) repetida no fundo das páginas de conteúdo.';
comment on column public.profiles.document_brand_color is
  'Cor principal dos documentos (hex). Faixa da capa, títulos.';
comment on column public.profiles.document_accent_color is
  'Cor de destaque dos documentos (hex). Filetes, realces, preço recomendado.';
