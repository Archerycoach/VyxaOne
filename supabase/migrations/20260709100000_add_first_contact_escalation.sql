-- Escalação de SLA de primeiro contacto: se o consultor já foi alertado e
-- continua sem contactar a lead passado ainda mais tempo, o team_lead (ou,
-- na falta de um, os brokers) são também notificados.
ALTER TABLE first_contact_alerts
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
