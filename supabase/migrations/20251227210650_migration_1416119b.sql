-- Create metrics table for storing calculated metrics
CREATE TABLE IF NOT EXISTS metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  metric_date date NOT NULL,
  value numeric NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS metrics_user_id_idx ON metrics(user_id);
CREATE INDEX IF NOT EXISTS metrics_type_date_idx ON metrics(metric_type, metric_date);

-- Enable RLS
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own metrics"
  ON metrics FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'team_lead')
    )
  );

CREATE POLICY "System can insert metrics"
  ON metrics FOR INSERT
  WITH CHECK (true);