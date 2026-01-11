-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buyer', 'seller', 'both')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'viewing', 'negotiating', 'closed', 'lost')),
  source TEXT,
  budget DECIMAL(12,2),
  min_budget DECIMAL(12,2),
  max_budget DECIMAL(12,2),
  location_preference TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  score INTEGER DEFAULT 0,
  score_factors JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Leads policies
CREATE POLICY "Users can view all leads" ON leads FOR SELECT USING (true);
CREATE POLICY "Users can insert leads" ON leads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update leads" ON leads FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete leads" ON leads FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_type ON leads(type);