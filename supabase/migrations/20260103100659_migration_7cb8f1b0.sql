-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  
  -- Lead metrics
  leads_created INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  leads_lost INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2),
  
  -- Property metrics
  properties_added INTEGER DEFAULT 0,
  properties_sold INTEGER DEFAULT 0,
  properties_rented INTEGER DEFAULT 0,
  
  -- Interaction metrics
  interactions_count INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  
  -- Task metrics
  tasks_created INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  
  -- Financial metrics
  revenue_generated NUMERIC(12,2) DEFAULT 0,
  commissions_earned NUMERIC(12,2) DEFAULT 0,
  
  -- Response time metrics
  avg_response_time_hours NUMERIC(10,2),
  avg_followup_time_hours NUMERIC(10,2),
  
  -- Score
  performance_score NUMERIC(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metrics
  custom_metrics JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT unique_user_period UNIQUE(user_id, period_start, period_end, period_type)
);

-- Enable RLS
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own performance metrics"
  ON performance_metrics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert performance metrics"
  ON performance_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update performance metrics"
  ON performance_metrics FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team performance metrics"
  ON performance_metrics FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead' AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_performance_metrics_user_period ON performance_metrics(user_id, period_start, period_end);
CREATE INDEX idx_performance_metrics_period_type ON performance_metrics(period_type);