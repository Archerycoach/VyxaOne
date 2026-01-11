-- Add whatsapp column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp text;