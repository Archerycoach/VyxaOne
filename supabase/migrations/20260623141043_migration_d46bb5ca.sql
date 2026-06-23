ALTER TABLE contact_alert_requests ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE contact_alert_requests ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE contact_alert_requests DROP CONSTRAINT IF EXISTS contact_alert_target_check;
ALTER TABLE contact_alert_requests ADD CONSTRAINT contact_alert_target_check CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL);

ALTER TABLE contact_opportunity_matches ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE contact_opportunity_matches ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE contact_opportunity_matches DROP CONSTRAINT IF EXISTS contact_opportunity_target_check;
ALTER TABLE contact_opportunity_matches ADD CONSTRAINT contact_opportunity_target_check CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL);