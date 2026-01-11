-- 1. Criar tabela workflow_executions em falta
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES lead_workflow_rules(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela image_uploads em falta
CREATE TABLE IF NOT EXISTS image_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Adicionar colunas em falta nas tabelas existentes
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS main_image_url TEXT;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS auto_message_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 4. Habilitar RLS para novas tabelas
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas de segurança (RLS)
CREATE POLICY "Users can view own workflow executions" ON workflow_executions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own workflow executions" ON workflow_executions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own workflow executions" ON workflow_executions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own image uploads" ON image_uploads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own image uploads" ON image_uploads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own image uploads" ON image_uploads FOR DELETE USING (user_id = auth.uid());