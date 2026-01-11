-- Update RLS policies for message_templates - Multi-tenancy isolation
DROP POLICY IF EXISTS "Users can view all templates" ON message_templates;

-- Create specific policy for viewing templates
-- Users can see their own templates + public templates (created_by is NULL)
CREATE POLICY "Users can view their own and public templates"
  ON message_templates FOR SELECT
  USING (auth.uid() = created_by OR created_by IS NULL);