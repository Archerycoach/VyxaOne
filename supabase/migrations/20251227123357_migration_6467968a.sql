-- Recreate RLS policies for message_templates table
DROP POLICY IF EXISTS "Admins can manage all templates" ON message_templates;

CREATE POLICY "Admins can manage all templates" ON message_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);