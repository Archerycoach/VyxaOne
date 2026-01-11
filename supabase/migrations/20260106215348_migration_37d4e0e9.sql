-- Adicionar coluna contact_id em calendar_events se não existir
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_contact ON calendar_events(contact_id) WHERE contact_id IS NOT NULL;

COMMENT ON COLUMN calendar_events.contact_id IS 'Reference to contact associated with this event';