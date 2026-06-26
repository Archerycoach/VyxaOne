-- Create ai_usage_logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own logs
CREATE POLICY "Users can view their own AI usage logs"
  ON ai_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: allow inserts (for server-side logging)
CREATE POLICY "Allow server-side AI usage logging"
  ON ai_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created 
  ON ai_usage_logs(user_id, created_at DESC);