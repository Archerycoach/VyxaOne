CREATE TABLE IF NOT EXISTS lead_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  consent_type TEXT NOT NULL DEFAULT 'marketing',
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked', 'pending')) DEFAULT 'pending',
  source TEXT,
  consent_text TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lead_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_consents" ON lead_consents;
CREATE POLICY "select_own_consents" ON lead_consents FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_consents" ON lead_consents;
CREATE POLICY "insert_own_consents" ON lead_consents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_consents" ON lead_consents;
CREATE POLICY "update_own_consents" ON lead_consents FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_consents" ON lead_consents;
CREATE POLICY "delete_own_consents" ON lead_consents FOR DELETE USING (auth.uid() = user_id);