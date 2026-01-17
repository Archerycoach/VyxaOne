-- Create goals table to store team and individual goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('team', 'individual')),
  period TEXT NOT NULL CHECK (period IN ('annual', 'semester')),
  year INTEGER NOT NULL,
  semester INTEGER CHECK (semester IN (1, 2)),
  
  -- Financial goals
  revenue_target DECIMAL(12, 2),
  
  -- Acquisition goals (angariações)
  acquisitions_target INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Unique constraint: one goal per user/type/period/year/semester
  UNIQUE(user_id, goal_type, period, year, semester)
);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Policies for goals table
-- Admins and team leads can view all goals
CREATE POLICY "Admins and team leads can view all goals"
  ON goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'team_lead')
    )
    OR user_id = auth.uid()
  );

-- Admins and team leads can create/update team goals
CREATE POLICY "Admins and team leads can manage team goals"
  ON goals FOR ALL
  USING (
    goal_type = 'team'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'team_lead')
    )
  );

-- Users can manage their own individual goals
CREATE POLICY "Users can manage their own goals"
  ON goals FOR ALL
  USING (
    goal_type = 'individual'
    AND user_id = auth.uid()
  );

-- Create index for better query performance
CREATE INDEX idx_goals_user_type ON goals(user_id, goal_type);
CREATE INDEX idx_goals_period ON goals(period, year, semester);

COMMENT ON TABLE goals IS 'Stores team and individual goals for revenue and acquisitions';