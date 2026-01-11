-- Update RLS policies to respect user roles

-- Admins and Managers can view all leads
DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
CREATE POLICY "Users can view leads based on role"
  ON leads FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Admins and Managers can view all properties
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
CREATE POLICY "Users can view properties based on role"
  ON properties FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Admins and Managers can view all tasks
DROP POLICY IF EXISTS "Users can view tasks they created or are assigned to" ON tasks;
CREATE POLICY "Users can view tasks based on role"
  ON tasks FOR SELECT
  USING (
    auth.uid() = created_by OR
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );