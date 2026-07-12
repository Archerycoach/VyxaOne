-- Landing pages públicas por imóvel/empreendimento.
-- landing_token: identificador não adivinhável para o URL público (mesmo
-- padrão de leads.portal_token). landing_published: a página só é servida
-- publicamente quando o agente carrega em "Publicar".

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS landing_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS landing_published boolean NOT NULL DEFAULT false;

ALTER TABLE developments
  ADD COLUMN IF NOT EXISTS landing_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS landing_published boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_landing_token ON properties(landing_token) WHERE landing_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_developments_landing_token ON developments(landing_token) WHERE landing_token IS NOT NULL;

-- Contagem de visitas/contactos agregada por dia (não uma linha por visita —
-- mantém a tabela pequena e é amigável ao RGPD, sem PII em bruto).
CREATE TABLE IF NOT EXISTS landing_page_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('property', 'development')),
  entity_id uuid NOT NULL,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  contacts integer NOT NULL DEFAULT 0,
  UNIQUE (entity_type, entity_id, day)
);

CREATE INDEX IF NOT EXISTS idx_landing_stats_entity ON landing_page_daily_stats(entity_type, entity_id, day);

-- As estatísticas são escritas pelo endpoint público (service-role, sem
-- sessão) e lidas pelo dono via API server-side; RLS ativa e sem políticas
-- para authenticated (ninguém lê diretamente com a anon key).
ALTER TABLE landing_page_daily_stats ENABLE ROW LEVEL SECURITY;

-- Incremento atómico de uma visita ou contacto do dia (evita corridas entre
-- pedidos concorrentes). SECURITY DEFINER porque é chamada pelo endpoint
-- público que corre com service-role.
CREATE OR REPLACE FUNCTION public.increment_landing_stat(
  p_entity_type text,
  p_entity_id uuid,
  p_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO landing_page_daily_stats (entity_type, entity_id, day, views, contacts)
  VALUES (
    p_entity_type,
    p_entity_id,
    current_date,
    CASE WHEN p_kind = 'view' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'contact' THEN 1 ELSE 0 END
  )
  ON CONFLICT (entity_type, entity_id, day) DO UPDATE SET
    views = landing_page_daily_stats.views + (CASE WHEN p_kind = 'view' THEN 1 ELSE 0 END),
    contacts = landing_page_daily_stats.contacts + (CASE WHEN p_kind = 'contact' THEN 1 ELSE 0 END);
END;
$$;
