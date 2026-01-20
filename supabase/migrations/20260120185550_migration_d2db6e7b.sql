-- 2. Criar tabela meta_webhook_logs (auditoria)
CREATE TABLE IF NOT EXISTS meta_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id TEXT NOT NULL,
  leadgen_id TEXT NOT NULL,
  form_id TEXT,
  ad_id TEXT,
  webhook_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meta_webhook_logs_page_id ON meta_webhook_logs(page_id);
CREATE INDEX IF NOT EXISTS idx_meta_webhook_logs_leadgen_id ON meta_webhook_logs(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_meta_webhook_logs_created_at ON meta_webhook_logs(created_at DESC);

-- RLS Policies
ALTER TABLE meta_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users podem ver seus próprios logs de webhook"
  ON meta_webhook_logs FOR SELECT
  USING (
    page_id IN (
      SELECT page_id FROM meta_integrations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode inserir logs de webhook"
  ON meta_webhook_logs FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE meta_webhook_logs IS 'Logs de webhooks recebidos da Meta para auditoria';
COMMENT ON COLUMN meta_webhook_logs.leadgen_id IS 'ID único do lead gerado pela Meta';
COMMENT ON COLUMN meta_webhook_logs.webhook_payload IS 'Payload completo do webhook recebido';
COMMENT ON COLUMN meta_webhook_logs.status IS 'Status do processamento: pending, success, error';

-- Grant permissions
GRANT SELECT, INSERT ON meta_webhook_logs TO authenticated;
GRANT SELECT, INSERT ON meta_webhook_logs TO anon;