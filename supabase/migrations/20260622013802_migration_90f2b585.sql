-- Adicionar campo para ativar sincronização automática diária na tabela meta_integrations
ALTER TABLE meta_integrations 
ADD COLUMN IF NOT EXISTS auto_daily_sync boolean DEFAULT false;

COMMENT ON COLUMN meta_integrations.auto_daily_sync IS 'Ativa sincronização automática diária de leads da Meta (backup da captura em tempo real)';

-- Adicionar campo para configurar hora da sincronização (formato 24h: 0-23)
ALTER TABLE meta_integrations 
ADD COLUMN IF NOT EXISTS daily_sync_hour integer DEFAULT 6 CHECK (daily_sync_hour >= 0 AND daily_sync_hour <= 23);

COMMENT ON COLUMN meta_integrations.daily_sync_hour IS 'Hora do dia para executar sincronização automática (0-23, padrão: 6h)';

-- Adicionar campo para rastrear última sincronização diária
ALTER TABLE meta_integrations 
ADD COLUMN IF NOT EXISTS last_daily_sync_at timestamp with time zone;

COMMENT ON COLUMN meta_integrations.last_daily_sync_at IS 'Timestamp da última sincronização diária automática executada';