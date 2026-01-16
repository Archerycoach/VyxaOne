-- Recreate improved RLS policies for tasks
-- Allow viewing tasks where user is creator OR assigned to
CREATE POLICY "Users can view their tasks" ON tasks
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() = assigned_to
  );

-- Allow creating tasks (user_id will be set automatically)
CREATE POLICY "Users can create tasks" ON tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow updating tasks where user is creator OR assigned to
CREATE POLICY "Users can update their tasks" ON tasks
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = assigned_to
  );

-- Allow deleting tasks where user is creator OR assigned to
CREATE POLICY "Users can delete their tasks" ON tasks
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = assigned_to
  );