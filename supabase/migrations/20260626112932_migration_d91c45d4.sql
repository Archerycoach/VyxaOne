ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_unsub_token UUID DEFAULT gen_random_uuid();

-- Update existing leads to have a token
UPDATE leads SET email_unsub_token = gen_random_uuid() WHERE email_unsub_token IS NULL;