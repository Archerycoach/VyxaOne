-- 1. Remove old incompatible columns
ALTER TABLE lead_workflow_rules 
  DROP COLUMN IF EXISTS days_until_followup,
  DROP COLUMN IF EXISTS event_title,
  DROP COLUMN IF EXISTS event_description,
  DROP COLUMN IF EXISTS event_duration_minutes;

-- 2. Add new flexible columns
ALTER TABLE lead_workflow_rules
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_hours INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Update existing rows to have default values (to avoid null issues)
UPDATE lead_workflow_rules 
SET 
  action_type = 'create_calendar_event',
  action_config = '{"title": "Follow-up", "duration": 60}'::jsonb
WHERE action_type IS NULL;

-- 4. Set NOT NULL constraint after populating data
ALTER TABLE lead_workflow_rules 
  ALTER COLUMN action_type SET NOT NULL;