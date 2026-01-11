-- Make user_id nullable in integration_settings if it exists and is not null
-- Or add it if missing but required by legacy types? 
-- Let's check schema first to be safe, but since I can't check easily in one step, 
-- I will alter it to be nullable which covers both "global settings" and "legacy user settings" cases.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_settings' AND column_name = 'user_id') THEN
    ALTER TABLE integration_settings ALTER COLUMN user_id DROP NOT NULL;
  ELSE
    -- If column doesn't exist but types say it's required, maybe I should add it as nullable?
    -- Adding it allows the types to match if they expect it.
    ALTER TABLE integration_settings ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;