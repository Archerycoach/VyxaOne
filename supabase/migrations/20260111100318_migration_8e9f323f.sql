-- Criar tabela para configurações do frontend
CREATE TABLE IF NOT EXISTS frontend_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE frontend_settings ENABLE ROW LEVEL SECURITY;

-- Admin can view and edit
CREATE POLICY "Admins can view frontend settings" ON frontend_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update frontend settings" ON frontend_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert frontend settings" ON frontend_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Everyone can view public settings (for landing page)
CREATE POLICY "Public can view public frontend settings" ON frontend_settings
  FOR SELECT USING (category = 'public');

-- Inserir configurações padrão
INSERT INTO frontend_settings (key, value, category, description) VALUES
  ('app_name', '"AgentPro"', 'public', 'Nome da aplicação'),
  ('app_tagline', '"Plataforma completa de CRM para profissionais imobiliários"', 'public', 'Slogan da aplicação'),
  ('primary_color', '"#1e40af"', 'public', 'Cor primária da marca'),
  ('secondary_color', '"#10b981"', 'public', 'Cor secundária da marca'),
  ('hero_title', '"Gestão Inteligente de Leads Imobiliários"', 'public', 'Título da hero section'),
  ('hero_subtitle', '"Organize, acompanhe e converta mais leads com a plataforma CRM feita especialmente para agentes imobiliários"', 'public', 'Subtítulo da hero section'),
  ('contact_email', '"suporte@agentpro.pt"', 'public', 'Email de contacto'),
  ('contact_phone', '"+351 123 456 789"', 'public', 'Telefone de contacto'),
  ('company_address', '"Lisboa, Portugal"', 'public', 'Morada da empresa')
ON CONFLICT (key) DO NOTHING;