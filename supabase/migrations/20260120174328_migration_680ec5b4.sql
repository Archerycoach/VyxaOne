-- 1. Criar tabela de integrações Meta (uma por página do utilizador)
CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  webhook_subscribed BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- Enable RLS
ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see/manage their own integrations
CREATE POLICY "Users can view their own Meta integrations" ON meta_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Meta integrations" ON meta_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Meta integrations" ON meta_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Meta integrations" ON meta_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_meta_integrations_user_id ON meta_integrations(user_id);
CREATE INDEX idx_meta_integrations_page_id ON meta_integrations(page_id);