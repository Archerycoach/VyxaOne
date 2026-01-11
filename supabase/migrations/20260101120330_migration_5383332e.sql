-- Criar tabela workflow_executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES lead_workflow_rules(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela image_uploads
CREATE TABLE IF NOT EXISTS image_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  public_url TEXT,
  entity_type TEXT, -- 'property', 'lead', etc
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela integration_settings
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_name TEXT NOT NULL, -- 'google_calendar', 'stripe', 'eupago', etc
  is_active BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status TEXT, -- 'success', 'failed'
  test_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, integration_name)
);

-- Adicionar colunas faltantes em leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS needs_financing BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_area DECIMAL(10, 2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS desired_price DECIMAL(12, 2);

-- Adicionar colunas faltantes em calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;