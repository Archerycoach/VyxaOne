-- Fix contacts table schema: change whatsapp from boolean to text
ALTER TABLE contacts DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE contacts ADD COLUMN whatsapp text;

-- Ensure other columns exist just in case
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_automation_types jsonb DEFAULT '["birthday", "celebration", "followup", "new_property", "reminder"]'::jsonb;