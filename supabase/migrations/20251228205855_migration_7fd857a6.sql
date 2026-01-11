-- Add WhatsApp automation configuration columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_automation_types jsonb DEFAULT '["birthday", "celebration", "followup", "new_property", "reminder"]'::jsonb;

-- Add WhatsApp automation configuration columns to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS whatsapp boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_automation_types jsonb DEFAULT '["birthday", "celebration", "followup", "new_property", "reminder"]'::jsonb,
ADD COLUMN IF NOT EXISTS birthday date,
ADD COLUMN IF NOT EXISTS source text;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_enabled ON leads(whatsapp_enabled) WHERE whatsapp_enabled = true;
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_enabled ON contacts(whatsapp_enabled) WHERE whatsapp_enabled = true;

-- Add converted_from_lead_id to track conversions
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS converted_from_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_converted_from ON contacts(converted_from_lead_id);