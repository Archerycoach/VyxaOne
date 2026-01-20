-- 3. Criar tabela meta_form_mappings (mapeamento de campos)
CREATE TABLE IF NOT EXISTS meta_form_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meta_form_mappings_user_id ON meta_form_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_form_mappings_form_id ON meta_form_mappings(form_id);

-- RLS Policies
ALTER TABLE meta_form_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users podem ver seus próprios mapeamentos"
  ON meta_form_mappings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users podem inserir seus próprios mapeamentos"
  ON meta_form_mappings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users podem atualizar seus próprios mapeamentos"
  ON meta_form_mappings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users podem deletar seus próprios mapeamentos"
  ON meta_form_mappings FOR DELETE
  USING (user_id = auth.uid());

-- Comentários
COMMENT ON TABLE meta_form_mappings IS 'Mapeamento de campos dos formulários Meta para campos do CRM';
COMMENT ON COLUMN meta_form_mappings.field_mappings IS 'JSON com mapeamento {campo_meta: campo_crm}';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON meta_form_mappings TO authenticated;