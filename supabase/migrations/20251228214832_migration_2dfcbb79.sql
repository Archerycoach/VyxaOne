-- Create lead_workflow_rules table
CREATE TABLE IF NOT EXISTS lead_workflow_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  trigger_status TEXT NOT NULL,
  days_until_followup INTEGER NOT NULL DEFAULT 3,
  event_title TEXT NOT NULL,
  event_description TEXT,
  event_duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lead_workflow_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own workflow rules" ON lead_workflow_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own workflow rules" ON lead_workflow_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workflow rules" ON lead_workflow_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workflow rules" ON lead_workflow_rules FOR DELETE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_workflow_rules_user_status ON lead_workflow_rules(user_id, trigger_status, enabled);