-- Drop all integration-related tables
DROP TABLE IF EXISTS google_calendar_events CASCADE;
DROP TABLE IF EXISTS gmail_messages CASCADE;
DROP TABLE IF EXISTS integration_credentials CASCADE;
DROP TABLE IF EXISTS integration_settings CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;