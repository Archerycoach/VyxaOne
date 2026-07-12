-- Parágrafo de introdução editável por página (o subtítulo mostrado por
-- baixo do título principal). Aplicado às páginas de marketing que têm esse
-- subtítulo; as páginas legais (privacidade, termos, eliminação de dados)
-- ficam de fora por serem texto jurídico. O texto atual fica sempre como
-- fallback no código — estas chaves só substituem quando preenchidas.
INSERT INTO frontend_settings (key, value, category, description) VALUES
  ('intro_about', 'null', 'public', 'Texto de introdução - página Sobre Nós'),
  ('intro_contact', 'null', 'public', 'Texto de introdução - página Contacto'),
  ('intro_pricing', 'null', 'public', 'Texto de introdução - página Preços'),
  ('intro_use_cases', 'null', 'public', 'Texto de introdução - página Casos de Uso'),
  ('intro_faq', 'null', 'public', 'Texto de introdução - página FAQ'),
  ('intro_documentation', 'null', 'public', 'Texto de introdução - página Documentação'),
  ('intro_support', 'null', 'public', 'Texto de introdução - página Suporte'),
  ('intro_features', 'null', 'public', 'Texto de introdução - página Funcionalidades')
ON CONFLICT (key) DO NOTHING;
