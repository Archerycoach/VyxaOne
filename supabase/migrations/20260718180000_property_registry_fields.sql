-- Campos da caderneta predial / certidão permanente no imóvel.
--
-- A leitura de documentos já extraía o artigo matricial e o valor patrimonial
-- tributário, mas não havia onde os guardar — ficavam visíveis no diálogo e
-- perdiam-se. Estes dois campos fecham essa lacuna e permitem criar a ficha
-- do imóvel diretamente a partir da caderneta.
--
-- Os restantes campos lidos (tipologia, classe energética, ano de construção,
-- andar) já existiam na tabela; só faltava expô-los no formulário.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.properties
  add column if not exists matrix_article text;

alter table public.properties
  add column if not exists taxable_value numeric;

comment on column public.properties.matrix_article is
  'Artigo matricial da caderneta predial (ex.: "791-G").';

comment on column public.properties.taxable_value is
  'Valor patrimonial tributário (VPT) constante da caderneta predial.';
