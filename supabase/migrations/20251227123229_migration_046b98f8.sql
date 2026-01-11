-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sales', 'leads', 'meetings', 'revenue')),
  target DECIMAL(12,2) NOT NULL,
  current DECIMAL(12,2) DEFAULT 0,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Goals policies
CREATE POLICY "Users can view their goals" ON goals FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Users can insert their goals" ON goals FOR INSERT WITH CHECK (auth.uid() = agent_id);
CREATE POLICY "Users can update their goals" ON goals FOR UPDATE USING (auth.uid() = agent_id);

-- Create index
CREATE INDEX idx_goals_agent_id ON goals(agent_id);