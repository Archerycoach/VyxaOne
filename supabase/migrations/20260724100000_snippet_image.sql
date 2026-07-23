-- ============================================================
-- Imagem opcional nas respostas rápidas (ex.: assinatura com logotipo)
--
-- A imagem só segue nos canais que a suportam: emails compostos DENTRO da
-- aplicação (HTML). O mailto e o WhatsApp pessoal não transportam imagens —
-- limitação dos próprios protocolos, não da aplicação.
--
-- Idempotente.
-- ============================================================

alter table public.message_snippets
  add column if not exists image_url text;

comment on column public.message_snippets.image_url is
  'URL público da imagem (storage). Embebida em emails HTML compostos na aplicação.';
