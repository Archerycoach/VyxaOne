-- Criar tabela de configurações do resumo diário
CREATE TABLE IF NOT EXISTS daily_digest_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  delivery_time TIME DEFAULT '08:00:00', -- Hora de envio (formato HH:MM:SS)
  send_notification BOOLEAN DEFAULT true, -- Enviar notificação in-app
  send_email BOOLEAN DEFAULT true, -- Enviar por email
  send_whatsapp BOOLEAN DEFAULT false, -- Enviar por WhatsApp
  include_hot_leads BOOLEAN DEFAULT true,
  include_tasks BOOLEAN DEFAULT true,
  include_events BOOLEAN DEFAULT true,
  include_overdue_proposals BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS policies
ALTER TABLE daily_digest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digest settings"
  ON daily_digest_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own digest settings"
  ON daily_digest_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own digest settings"
  ON daily_digest_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE daily_digest_settings IS 'Configurações do resumo diário por utilizador';
COMMENT ON COLUMN daily_digest_settings.delivery_time IS 'Hora de envio do resumo diário (HH:MM:SS)';
COMMENT ON COLUMN daily_digest_settings.send_notification IS 'Enviar notificação in-app';
COMMENT ON COLUMN daily_digest_settings.send_email IS 'Enviar por email via SMTP';
COMMENT ON COLUMN daily_digest_settings.send_whatsapp IS 'Enviar por WhatsApp (se tiver número configurado)';