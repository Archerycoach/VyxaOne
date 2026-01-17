-- CALENDAR_EVENTS - Hierarquia completa
DROP POLICY IF EXISTS "View calendar events by hierarchy" ON calendar_events;

CREATE POLICY "View calendar events by hierarchy"
ON calendar_events FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'team_lead'
    )
    AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid()
    )
  )
);