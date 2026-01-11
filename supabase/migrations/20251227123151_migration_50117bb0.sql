-- Create interactions table (history)
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'viewing', 'whatsapp', 'note')),
  title TEXT NOT NULL,
  notes TEXT,
  outcome TEXT,
  duration INTEGER,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Interactions policies
CREATE POLICY "Users can view all interactions" ON interactions FOR SELECT USING (true);
CREATE POLICY "Users can insert interactions" ON interactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their interactions" ON interactions FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their interactions" ON interactions FOR DELETE USING (auth.uid() = created_by);

-- Create indexes
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_interactions_created_at ON interactions(created_at DESC);