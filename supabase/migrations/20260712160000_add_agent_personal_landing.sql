-- Landing page pessoal do consultor: uma página pública com a foto, textos e
-- contacto do agente, mais os seus imóveis publicados. Configurável nas
-- Definições. landing_token = URL não adivinhável; landing_published = só é
-- servida quando o consultor a publica.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS landing_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS landing_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_headline text,
  ADD COLUMN IF NOT EXISTS landing_bio text;

CREATE INDEX IF NOT EXISTS idx_profiles_landing_token ON profiles(landing_token) WHERE landing_token IS NOT NULL;
