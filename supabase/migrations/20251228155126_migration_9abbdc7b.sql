CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  score INTEGER DEFAULT 0,
  factors JSONB,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);