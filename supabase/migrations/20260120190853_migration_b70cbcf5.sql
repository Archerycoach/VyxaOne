-- Fase 1.4: Criar tabela de histórico de sincronizações
CREATE TABLE IF NOT EXISTS meta_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  form_id TEXT,
  sync_type TEXT NOT NULL, -- 'webhook', 'manual', 'scheduled', 'retroactive'
  leads_processed INTEGER DEFAULT 0,
  leads_created INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE meta_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync history" ON meta_sync_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync history" ON meta_sync_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_meta_sync_history_user_id ON meta_sync_history(user_id);
CREATE INDEX idx_meta_sync_history_created_at ON meta_sync_history(created_at DESC);
CREATE INDEX idx_meta_sync_history_status ON meta_sync_history(status);