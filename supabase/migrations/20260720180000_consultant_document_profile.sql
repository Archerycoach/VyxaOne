-- Folhas de rosto e de fim dos documentos entregues ao cliente.
--
-- Os relatórios (avaliação de mercado, simulação de financiamento) passam a
-- ter capa e folha final com a apresentação do consultor, ao estilo dos
-- estudos de mercado que as redes imobiliárias entregam.
--
-- O texto é ESCRITO PELO CONSULTOR, não gerado por IA: é uma apresentação
-- pessoal, com credenciais e percurso próprios. Um modelo inventaria anos de
-- experiência e prémios que a pessoa não tem, num documento que vai à frente
-- do cliente.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.profiles
  add column if not exists document_cover_title text;

alter table public.profiles
  add column if not exists document_about_me text;

alter table public.profiles
  add column if not exists document_closing_text text;

alter table public.profiles
  add column if not exists ami_license text;

comment on column public.profiles.document_cover_title is
  'Subtítulo da capa dos documentos (ex.: "Consultor Imobiliário · Lisboa").';
comment on column public.profiles.document_about_me is
  'Apresentação do consultor, escrita por ele, para a folha de rosto dos documentos.';
comment on column public.profiles.document_closing_text is
  'Mensagem de fecho dos documentos, escrita pelo consultor.';
comment on column public.profiles.ami_license is
  'Número de licença AMI da mediadora, para constar nos documentos.';
