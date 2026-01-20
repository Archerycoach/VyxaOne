-- Fase 1.2: Criar tabela de configurações por formulário
CREATE TABLE IF NOT EXISTS meta_form_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  is_active BOOLEAN DEFAULT true,
  auto_assign_to UUID REFERENCES auth.users(id),
  default_status TEXT DEFAULT 'new',
  notification_email TEXT,
  custom_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

-- RLS Policies
ALTER TABLE meta_form_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own form configs" ON meta_form_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own form configs" ON meta_form_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own form configs" ON meta_form_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own form configs" ON meta_form_configs FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_meta_form_configs_user_id ON meta_form_configs(user_id);
CREATE INDEX idx_meta_form_configs_form_id ON meta_form_configs(form_id);