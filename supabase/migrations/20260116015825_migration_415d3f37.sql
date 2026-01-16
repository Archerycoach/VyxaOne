-- Update RLS policies: STRICT - only show tasks created by you
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;

CREATE POLICY "Users can view their own tasks" ON tasks
  FOR SELECT
  USING (auth.uid() = user_id);