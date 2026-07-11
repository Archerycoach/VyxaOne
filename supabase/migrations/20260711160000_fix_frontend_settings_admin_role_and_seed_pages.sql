-- A migração 20260626194839 trocou, por engano, "role = 'admin'" por
-- "role = 'broker'" nas políticas não-públicas de frontend_settings (mesmo
-- bug já corrigido noutras tabelas nesta sessão) — bloqueava qualquer
-- utilizador 'admin' de gerir estas configurações. Corrige para aceitar
-- ambos os papéis.
DROP POLICY IF EXISTS "Admins can insert frontend settings" ON frontend_settings;
DROP POLICY IF EXISTS "Admins can update frontend settings" ON frontend_settings;
DROP POLICY IF EXISTS "Admins can view frontend settings" ON frontend_settings;

CREATE POLICY "Admins can insert frontend settings" ON frontend_settings
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));

CREATE POLICY "Admins can update frontend settings" ON frontend_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));

CREATE POLICY "Admins can view frontend settings" ON frontend_settings
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'broker'::user_role)));

-- Corrige os valores de contacto que ficaram desde a marca antiga
-- ("AgentPro") e nunca foram atualizados, para corresponder ao que já está
-- escrito (fixo) nas próprias páginas (suporte@vyxa.pt, privacy@vyxa.pt).
UPDATE frontend_settings SET value = '"suporte@vyxa.pt"' WHERE key = 'contact_email';

INSERT INTO frontend_settings (key, value, category, description) VALUES
  ('privacy_email', '"privacy@vyxa.pt"', 'public', 'Email para questões de privacidade/RGPD')
ON CONFLICT (key) DO NOTHING;

-- Título/descrição (SEO) e título principal (H1) editáveis por página, para
-- as páginas públicas estáticas do site. O texto atual de cada página fica
-- sempre como fallback no código — estas chaves só substituem quando
-- preenchidas pelo admin em Definições > Frontend > Páginas do Site.
INSERT INTO frontend_settings (key, value, category, description) VALUES
  ('seo_title_about', 'null', 'public', 'Título da aba (SEO) - página Sobre Nós'),
  ('seo_description_about', 'null', 'public', 'Descrição (SEO) - página Sobre Nós'),
  ('heading_about', 'null', 'public', 'Título principal - página Sobre Nós'),

  ('seo_title_contact', 'null', 'public', 'Título da aba (SEO) - página Contacto'),
  ('seo_description_contact', 'null', 'public', 'Descrição (SEO) - página Contacto'),
  ('heading_contact', 'null', 'public', 'Título principal - página Contacto'),

  ('seo_title_pricing', 'null', 'public', 'Título da aba (SEO) - página Preços'),
  ('seo_description_pricing', 'null', 'public', 'Descrição (SEO) - página Preços'),
  ('heading_pricing', 'null', 'public', 'Título principal - página Preços'),

  ('seo_title_use_cases', 'null', 'public', 'Título da aba (SEO) - página Casos de Uso'),
  ('seo_description_use_cases', 'null', 'public', 'Descrição (SEO) - página Casos de Uso'),
  ('heading_use_cases', 'null', 'public', 'Título principal - página Casos de Uso'),

  ('seo_title_faq', 'null', 'public', 'Título da aba (SEO) - página FAQ'),
  ('seo_description_faq', 'null', 'public', 'Descrição (SEO) - página FAQ'),
  ('heading_faq', 'null', 'public', 'Título principal - página FAQ'),

  ('seo_title_documentation', 'null', 'public', 'Título da aba (SEO) - página Documentação'),
  ('seo_description_documentation', 'null', 'public', 'Descrição (SEO) - página Documentação'),
  ('heading_documentation', 'null', 'public', 'Título principal - página Documentação'),

  ('seo_title_support', 'null', 'public', 'Título da aba (SEO) - página Suporte'),
  ('seo_description_support', 'null', 'public', 'Descrição (SEO) - página Suporte'),
  ('heading_support', 'null', 'public', 'Título principal - página Suporte'),

  ('seo_title_features', 'null', 'public', 'Título da aba (SEO) - página Funcionalidades'),
  ('seo_description_features', 'null', 'public', 'Descrição (SEO) - página Funcionalidades'),
  ('heading_features', 'null', 'public', 'Título principal - página Funcionalidades'),

  ('seo_title_privacy_policy', 'null', 'public', 'Título da aba (SEO) - página Política de Privacidade'),
  ('seo_description_privacy_policy', 'null', 'public', 'Descrição (SEO) - página Política de Privacidade'),
  ('heading_privacy_policy', 'null', 'public', 'Título principal - página Política de Privacidade'),

  ('seo_title_terms_of_service', 'null', 'public', 'Título da aba (SEO) - página Termos de Serviço'),
  ('seo_description_terms_of_service', 'null', 'public', 'Descrição (SEO) - página Termos de Serviço'),
  ('heading_terms_of_service', 'null', 'public', 'Título principal - página Termos de Serviço'),

  ('seo_title_data_deletion', 'null', 'public', 'Título da aba (SEO) - página Eliminação de Dados'),
  ('seo_description_data_deletion', 'null', 'public', 'Descrição (SEO) - página Eliminação de Dados'),
  ('heading_data_deletion', 'null', 'public', 'Título principal - página Eliminação de Dados')
ON CONFLICT (key) DO NOTHING;
