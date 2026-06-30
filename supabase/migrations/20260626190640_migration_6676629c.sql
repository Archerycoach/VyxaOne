-- Adicionar campo para rastrear primeiro contacto na tabela leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_contact_at timestamptz;

COMMENT ON COLUMN leads.first_contact_at IS 'Data/hora do primeiro contacto com a lead (primeira interação outbound)';

-- Adicionar campo para configuração de tempo máximo para primeiro contacto
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_contact_alert_minutes integer DEFAULT 15;

COMMENT ON COLUMN profiles.first_contact_alert_minutes IS 'Minutos máximos para primeiro contacto antes de alertar (default 15)';

-- Criar índice para otimizar query de leads sem primeiro contacto
CREATE INDEX IF NOT EXISTS idx_leads_first_contact_pending 
ON leads(created_at, first_contact_at) 
WHERE first_contact_at IS NULL AND status IN ('new', 'contacted');

-- Criar tabela para rastrear alertas já enviados (evitar duplicação)
CREATE TABLE IF NOT EXISTS first_contact_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alerted_at timestamptz NOT NULL DEFAULT now(),
  alert_type text NOT NULL, -- 'notification', 'whatsapp', 'both'
  minutes_elapsed integer NOT NULL,
  UNIQUE(lead_id)
);

COMMENT ON TABLE first_contact_alerts IS 'Rastreia alertas de primeiro contacto já enviados para evitar duplicação';

-- RLS para first_contact_alerts
ALTER TABLE first_contact_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own first contact alerts"
  ON first_contact_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert first contact alerts"
  ON first_contact_alerts FOR INSERT
  WITH CHECK (true);

-- Criar índice para otimizar verificação de alertas já enviados
CREATE INDEX IF NOT EXISTS idx_first_contact_alerts_lead 
ON first_contact_alerts(lead_id);