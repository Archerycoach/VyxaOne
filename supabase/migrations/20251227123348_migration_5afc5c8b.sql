-- Recreate RLS policies for goals table with role column
DROP POLICY IF EXISTS "Admins can manage all goals" ON goals;
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;

CREATE POLICY "Admins can manage all goals" ON goals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view their own goals" ON goals FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Users can update their own goals" ON goals FOR UPDATE USING (auth.uid() = agent_id);