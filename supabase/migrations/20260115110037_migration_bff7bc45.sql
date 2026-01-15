-- Allow all authenticated users to read integration settings
-- This is needed so users can check if Google Calendar is configured
CREATE POLICY "authenticated_users_view_integration_settings"
ON integration_settings
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);