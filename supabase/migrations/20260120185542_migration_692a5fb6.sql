-- 1. Criar tabela meta_app_settings (configurações Admin)
CREATE TABLE IF NOT EXISTS meta_app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id TEXT NOT NULL,
  app_secret TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (apenas admins)
ALTER TABLE meta_app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem ver configurações Meta"
  ON meta_app_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem atualizar configurações Meta"
  ON meta_app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem inserir configurações Meta"
  ON meta_app_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Comentários
COMMENT ON TABLE meta_app_settings IS 'Configurações globais da Meta App (apenas Admin)';
COMMENT ON COLUMN meta_app_settings.app_id IS 'Meta App ID';
COMMENT ON COLUMN meta_app_settings.app_secret IS 'Meta App Secret';
COMMENT ON COLUMN meta_app_settings.verify_token IS 'Token de verificação do webhook';
COMMENT ON COLUMN meta_app_settings.webhook_url IS 'URL do webhook configurado';

-- Inserir registro inicial vazio
INSERT INTO meta_app_settings (app_id, app_secret, verify_token, webhook_url, is_active)
VALUES ('', '', gen_random_uuid()::text, '', false)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, UPDATE, INSERT ON meta_app_settings TO authenticated;