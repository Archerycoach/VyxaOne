-- Add template_id column to lead_workflow_rules to link to global templates
ALTER TABLE lead_workflow_rules ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_rules_template ON lead_workflow_rules(template_id);