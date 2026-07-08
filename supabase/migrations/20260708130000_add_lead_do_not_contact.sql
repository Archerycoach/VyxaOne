-- Marcação manual do consultor: "esta lead não quer ser contactada".
-- Bloqueia envios automáticos de email (Alertas de Procura, AI Property
-- Matcher) e mensagens de WhatsApp (em massa e individuais), mas não afeta
-- quem não tiver esta marcação explicitamente ativada.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;
