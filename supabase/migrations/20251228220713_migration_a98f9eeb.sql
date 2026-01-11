-- Create workflow_templates table (global templates created by admin)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_status TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}',
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  is_global BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage workflow templates"
ON workflow_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Everyone can view global templates
CREATE POLICY "Everyone can view global templates"
ON workflow_templates FOR SELECT
USING (is_global = true);

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_workflow_templates_global ON workflow_templates(is_global);