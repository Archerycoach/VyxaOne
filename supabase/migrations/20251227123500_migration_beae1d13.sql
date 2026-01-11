-- Create portal_integrations table
CREATE TABLE IF NOT EXISTS portal_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal TEXT NOT NULL CHECK (portal IN ('idealista', 'imovirtual', 'casa_sapo', 'custom')),
  api_key TEXT,
  active BOOLEAN DEFAULT true,
  leads_imported INTEGER DEFAULT 0,
  properties_published INTEGER DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE portal_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage integrations" ON portal_integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can view integrations" ON portal_integrations FOR SELECT USING (true);