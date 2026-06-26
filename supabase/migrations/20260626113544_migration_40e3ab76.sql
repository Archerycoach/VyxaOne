-- Add last_reactivation_sent_at field for idempotency
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reactivation_sent_at TIMESTAMPTZ;