-- Add provider and model columns to gpt_api_keys
ALTER TABLE gpt_api_keys 
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'gpt-4o-mini';

-- Remove the UNIQUE constraint on api_key (it prevents multiple users from using the same key)
ALTER TABLE gpt_api_keys DROP CONSTRAINT IF EXISTS gpt_api_keys_api_key_key;

-- Add index for faster lookups by user_id and is_active
CREATE INDEX IF NOT EXISTS idx_gpt_api_keys_user_active ON gpt_api_keys(user_id, is_active);