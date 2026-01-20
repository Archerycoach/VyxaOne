-- Fase 1.3: Criar tabela de mapeamento campo a campo
CREATE TABLE IF NOT EXISTS meta_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_config_id UUID NOT NULL REFERENCES meta_form_configs(id) ON DELETE CASCADE,
  meta_field_name TEXT NOT NULL,
  meta_field_label TEXT,
  crm_field_name TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  is_required BOOLEAN DEFAULT false,
  transform_rule TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(form_config_id, meta_field_name)
);

-- RLS Policies
ALTER TABLE meta_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mappings of own forms" ON meta_field_mappings 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meta_form_configs 
      WHERE meta_form_configs.id = meta_field_mappings.form_config_id 
      AND meta_form_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert mappings for own forms" ON meta_field_mappings 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meta_form_configs 
      WHERE meta_form_configs.id = meta_field_mappings.form_config_id 
      AND meta_form_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update mappings of own forms" ON meta_field_mappings 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meta_form_configs 
      WHERE meta_form_configs.id = meta_field_mappings.form_config_id 
      AND meta_form_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete mappings of own forms" ON meta_field_mappings 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM meta_form_configs 
      WHERE meta_form_configs.id = meta_field_mappings.form_config_id 
      AND meta_form_configs.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_meta_field_mappings_form_config ON meta_field_mappings(form_config_id);