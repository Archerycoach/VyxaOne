-- Criar tabela de templates de email
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'daily_email', 'workflow', 'whatsapp'
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSONB DEFAULT '[]'::jsonb, -- Lista de variáveis disponíveis
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_user ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_default ON email_templates(is_default) WHERE is_default = true;

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e editar tudo
CREATE POLICY "Admins can manage all templates" ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users podem ver e editar apenas seus templates
CREATE POLICY "Users can manage own templates" ON email_templates
  FOR ALL USING (
    auth.uid() = user_id
  );

-- Todos podem ver templates padrão
CREATE POLICY "Everyone can view default templates" ON email_templates
  FOR SELECT USING (is_default = true);