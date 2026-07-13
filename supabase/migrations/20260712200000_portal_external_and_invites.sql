-- Links externos no Portal do Cliente: além dos imóveis do CRM, o consultor
-- pode adicionar links externos (ex: anúncio no Idealista) que aparecem na
-- secção "Imóveis para si" como se fossem do portal.
CREATE TABLE IF NOT EXISTS portal_external_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  image_url text,
  price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_external_lead ON portal_external_listings(lead_id);

ALTER TABLE portal_external_listings ENABLE ROW LEVEL SECURITY;

-- O consultor gere os links das suas leads; o portal lê via service-role.
DROP POLICY IF EXISTS "manage own portal external listings" ON portal_external_listings;
CREATE POLICY "manage own portal external listings" ON portal_external_listings
  FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid()))
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid()));

-- Automação: enviar automaticamente o link do portal a novas leads.
-- auto_portal_invite (por consultor, opt-in) + marca para não reenviar.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_portal_invite boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS portal_invite_sent_at timestamptz;
