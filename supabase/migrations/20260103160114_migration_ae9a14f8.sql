-- Add google_event_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS google_event_id text,
ADD COLUMN IF NOT EXISTS is_synced boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_google_sync ON tasks(google_event_id, is_synced);