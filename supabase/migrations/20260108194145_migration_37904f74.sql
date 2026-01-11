-- Remove ALL integration-related tables
DROP TABLE IF EXISTS integration_logs CASCADE;
DROP TABLE IF EXISTS integration_usage CASCADE;
DROP TABLE IF EXISTS integration_webhooks CASCADE;
DROP TABLE IF EXISTS oauth_tokens CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- Remove any remaining integration columns from other tables
ALTER TABLE profiles DROP COLUMN IF EXISTS gmail_connected CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS google_calendar_connected CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS whatsapp_connected CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS integration_settings CASCADE;

-- Remove integration-related functions
DROP FUNCTION IF EXISTS notify_integration_change() CASCADE;
DROP FUNCTION IF EXISTS log_integration_usage() CASCADE;
DROP FUNCTION IF EXISTS validate_integration_credentials() CASCADE;