-- Update RLS policies to use created_by instead of user_id
DROP POLICY IF EXISTS "Users can insert their own templates" ON message_templates;
CREATE POLICY "Users can insert their own templates" 
ON message_templates FOR INSERT 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view their own templates" ON message_templates;
CREATE POLICY "Users can view their own templates" 
ON message_templates FOR SELECT 
USING (auth.uid() = created_by OR created_by IS NULL); -- Allow viewing system templates if any

DROP POLICY IF EXISTS "Users can update their own templates" ON message_templates;
CREATE POLICY "Users can update their own templates" 
ON message_templates FOR UPDATE 
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own templates" ON message_templates;
CREATE POLICY "Users can delete their own templates" 
ON message_templates FOR DELETE 
USING (auth.uid() = created_by);