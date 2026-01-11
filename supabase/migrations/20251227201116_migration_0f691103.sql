-- Update RLS policies for interactions - Multi-tenancy isolation
DROP POLICY IF EXISTS "Users can view all interactions" ON interactions;
DROP POLICY IF EXISTS "Users can insert interactions" ON interactions;
DROP POLICY IF EXISTS "Users can update their interactions" ON interactions;
DROP POLICY IF EXISTS "Users can delete their interactions" ON interactions;

-- Users can only see their own interactions
CREATE POLICY "Users can view their own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = created_by);

-- Users can only insert their own interactions
CREATE POLICY "Users can insert their own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can only update their own interactions
CREATE POLICY "Users can update their own interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can only delete their own interactions
CREATE POLICY "Users can delete their own interactions"
  ON interactions FOR DELETE
  USING (auth.uid() = created_by);