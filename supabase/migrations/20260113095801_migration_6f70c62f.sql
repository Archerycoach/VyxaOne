-- Create table for lead columns configuration
CREATE TABLE IF NOT EXISTS lead_columns_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  column_key TEXT NOT NULL,
  column_label TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  column_order INTEGER NOT NULL,
  column_width TEXT DEFAULT 'auto',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(column_key)
);

-- Enable RLS
ALTER TABLE lead_columns_config ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only
CREATE POLICY "Admins can manage lead columns config" ON lead_columns_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default columns configuration
INSERT INTO lead_columns_config (column_key, column_label, is_visible, column_order, column_width) VALUES
  ('name', 'Nome', true, 1, '250px'),
  ('email', 'Email', true, 2, '200px'),
  ('phone', 'Telefone', true, 3, '150px'),
  ('status', 'Status', true, 4, '120px'),
  ('lead_type', 'Tipo', true, 5, '120px'),
  ('location_preference', 'Localização', true, 6, '150px'),
  ('property_type', 'Tipo de Imóvel', true, 7, '150px'),
  ('budget_min', 'Orçamento Mín.', true, 8, '130px'),
  ('budget_max', 'Orçamento Máx.', true, 9, '130px'),
  ('bedrooms', 'Quartos', false, 10, '100px'),
  ('bathrooms', 'Casas de Banho', false, 11, '120px'),
  ('min_area', 'Área Mín.', false, 12, '100px'),
  ('property_area', 'Área', false, 13, '100px'),
  ('desired_price', 'Preço Desejado', false, 14, '130px'),
  ('needs_financing', 'Financiamento', false, 15, '120px'),
  ('created_at', 'Data Criação', true, 16, '150px'),
  ('assigned_to', 'Atribuído a', false, 17, '150px')
ON CONFLICT (column_key) DO NOTHING;