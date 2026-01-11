-- Create client_portal_access table
CREATE TABLE IF NOT EXISTS client_portal_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  selected_properties JSONB DEFAULT '[]',
  documents_shared JSONB DEFAULT '[]',
  last_access TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;

-- Client portal policies
CREATE POLICY "Agents can view all portal access" ON client_portal_access FOR SELECT USING (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Agents can insert portal access" ON client_portal_access FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Agents can update portal access" ON client_portal_access FOR UPDATE USING (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Agents can delete portal access" ON client_portal_access FOR DELETE USING (
  auth.uid() IS NOT NULL
);

-- Create index
CREATE INDEX idx_portal_access_code ON client_portal_access(access_code);
CREATE INDEX idx_portal_lead_id ON client_portal_access(lead_id);