-- =====================================================
-- SCRIPT DE DADOS DE TESTE - Imogest
-- =====================================================
-- Este script popula a base de dados de testes com dados fictícios realistas
-- USE APENAS EM AMBIENTE DE TESTES!
--
-- Para executar:
-- 1. Certifique-se de que está no projeto Supabase de TESTES
-- 2. Execute este script no SQL Editor
-- 3. Ou use: npm run db:seed:testing
-- =====================================================

-- Limpar dados existentes primeiro (CUIDADO!)
TRUNCATE TABLE interactions CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE properties CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- =====================================================
-- 1. PROFILES (Usuários de Teste)
-- =====================================================
-- Senha para todos: Test123!
-- Hash bcrypt de "Test123!": $2a$10$XqJb5g7QM5z9Xr8K9N2Lh.Y5Z6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0

INSERT INTO profiles (id, email, full_name, role, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@teste.com', 'Administrador Teste', 'admin', NOW() - INTERVAL '90 days'),
  ('22222222-2222-2222-2222-222222222222', 'gestor1@teste.com', 'Carlos Mendes', 'user', NOW() - INTERVAL '60 days'),
  ('33333333-3333-3333-3333-333333333333', 'gestor2@teste.com', 'Ana Costa', 'user', NOW() - INTERVAL '45 days');

-- =====================================================
-- 2. CONTACTS (Contactos de Teste)
-- =====================================================

INSERT INTO contacts (id, name, email, phone, type, notes, user_id, created_at) VALUES
  (gen_random_uuid(), 'João Silva', 'joao.silva@email.com', '912345678', 'buyer', 'Interessado em apartamentos T2/T3 em Lisboa. Orçamento até 300k.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'Maria Santos', 'maria.santos@email.com', '923456789', 'seller', 'Quer vender moradia em Cascais. Urgente.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'Pedro Costa', 'pedro.costa@email.com', '934567890', 'buyer', 'Primeiro comprador. Procura T1 perto do metro.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'Ana Rodrigues', 'ana.rodrigues@email.com', '945678901', 'both', 'Quer trocar apartamento por moradia.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'Luís Fernandes', 'luis.fernandes@email.com', '956789012', 'investor', 'Investidor com portfólio. Procura boas oportunidades.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), 'Rita Oliveira', 'rita.oliveira@email.com', '967890123', 'buyer', 'Orçamento flexível. Gosta de propriedades modernas.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), 'Carlos Pereira', 'carlos.pereira@email.com', '978901234', 'seller', 'Tem vários imóveis para vender. Contactar ASAP.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), 'Sofia Martins', 'sofia.martins@email.com', '989012345', 'buyer', 'Jovem casal. Procura primeira casa até 200k.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), 'Miguel Alves', 'miguel.alves@email.com', '990123456', 'investor', 'Compra para arrendamento. Rendibilidade mínima 5%.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'Teresa Gonçalves', 'teresa.goncalves@email.com', '911234567', 'seller', 'Herança. Quer vender rápido.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'Ricardo Sousa', 'ricardo.sousa@email.com', '922345678', 'buyer', 'Procura terreno para construção.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'Patrícia Dias', 'patricia.dias@email.com', '933456789', 'both', 'Quer fazer upgrade. Vende T2 e compra T3.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'Bruno Carvalho', 'bruno.carvalho@email.com', '944567890', 'buyer', 'Expatriado a regressar. Procura em Algarve.', '33333333-3333-3333-3333-333333333333', NOW()),
  (gen_random_uuid(), 'Inês Ribeiro', 'ines.ribeiro@email.com', '955678901', 'seller', 'Reforma. Quer vender e ir para apartamento menor.', '22222222-2222-2222-2222-222222222222', NOW()),
  (gen_random_uuid(), 'André Lopes', 'andre.lopes@email.com', '966789012', 'investor', 'Procura imóveis para reabilitar e vender.', '33333333-3333-3333-3333-333333333333', NOW());

-- =====================================================
-- 3. LEADS (Leads de Teste)
-- =====================================================

INSERT INTO leads (id, name, email, phone, source, status, score, budget, notes, user_id, created_at) VALUES
  (gen_random_uuid(), 'Fernando Nunes', 'fernando.nunes@email.com', '912111111', 'website', 'new', 8, 250000, 'Contactou via website. Muito interessado em Lisboa.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'Carla Mendes', 'carla.mendes@email.com', '923222222', 'referral', 'contacted', 9, 400000, 'Referência de cliente satisfeito. Hot lead!', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), 'Rui Teixeira', 'rui.teixeira@email.com', '934333333', 'facebook', 'qualified', 7, 180000, 'Respondeu a anúncio no Facebook. Primeiro comprador.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'Sandra Pinto', 'sandra.pinto@email.com', '945444444', 'website', 'proposal', 10, 350000, 'Já viu 3 imóveis. Pronta para fechar negócio.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'Nuno Barbosa', 'nuno.barbosa@email.com', '956555555', 'google', 'negotiation', 9, 280000, 'Em negociação. Falta apenas financiamento.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'Helena Marques', 'helena.marques@email.com', '967666666', 'referral', 'won', 10, 320000, 'VENDIDO! Cliente satisfeito. Pedir testemunho.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'Paulo Ferreira', 'paulo.ferreira@email.com', '978777777', 'website', 'lost', 3, 150000, 'Perdido para concorrência. Preço muito baixo.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '50 days'),
  (gen_random_uuid(), 'Cristina Ramos', 'cristina.ramos@email.com', '989888888', 'instagram', 'new', 6, 200000, 'Contacto via Instagram. Parece genuína.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'Vitor Moreira', 'vitor.moreira@email.com', '990999999', 'email', 'contacted', 7, 450000, 'Email direto. Empresário. Procura investimento.', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), 'Mónica Silva', 'monica.silva@email.com', '911000000', 'phone', 'qualified', 8, 300000, 'Telefonema. Muito específica sobre localização.', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '12 days');

-- =====================================================
-- 4. PROPERTIES (Propriedades de Teste)
-- =====================================================

INSERT INTO properties (id, title, description, price, location, bedrooms, bathrooms, area, property_type, status, user_id, created_at) VALUES
  (gen_random_uuid(), 'Apartamento T2 Moderno - Benfica', 'Apartamento completamente remodelado com acabamentos de luxo. Varanda ampla com vista desafogada.', 280000, 'Benfica, Lisboa', 2, 2, 85, 'apartment', 'available', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'Moradia V3 com Piscina - Cascais', 'Linda moradia isolada com piscina e jardim. Zona premium de Cascais. Garagem para 2 carros.', 650000, 'Cascais', 3, 3, 220, 'house', 'available', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'T1 Perto do Metro - Saldanha', 'Ideal para investimento ou primeira habitação. A 5min do metro. Condomínio com piscina.', 195000, 'Saldanha, Lisboa', 1, 1, 52, 'apartment', 'available', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'Terreno Urbano - Sintra', 'Terreno para construção com projeto aprovado. Vista para a serra. 500m2.', 150000, 'Sintra', 0, 0, 500, 'land', 'available', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'Apartamento T3 Duplex - Parque das Nações', 'Duplex moderno em condomínio fechado. 2 lugares de garagem. Ginásio e piscina no condomínio.', 420000, 'Parque das Nações, Lisboa', 3, 2, 145, 'apartment', 'under_contract', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'Moradia V4 para Renovar - Almada', 'Ótima oportunidade de investimento. Moradia antiga em lote de 300m2. Potencial enorme.', 220000, 'Almada', 4, 2, 180, 'house', 'available', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), 'Penthouse T2 - Avenidas Novas', 'Último piso com terraço de 80m2. Vista panorâmica. Acabamentos de luxo. Ar condicionado.', 550000, 'Avenidas Novas, Lisboa', 2, 2, 110, 'apartment', 'available', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'Quinta com 2 Hectares - Alentejo', 'Propriedade rural com casa renovada, piscina e olival. Ideal para turismo rural.', 850000, 'Évora, Alentejo', 5, 4, 300, 'house', 'available', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '45 days');

-- =====================================================
-- 5. INTERACTIONS (Interações de Teste)
-- =====================================================

-- Vamos criar interações para alguns leads e contactos
DO $$
DECLARE
  lead_id1 UUID;
  lead_id2 UUID;
  contact_id1 UUID;
  contact_id2 UUID;
BEGIN
  -- Buscar IDs de leads e contactos para usar nas interações
  SELECT id INTO lead_id1 FROM leads WHERE email = 'fernando.nunes@email.com';
  SELECT id INTO lead_id2 FROM leads WHERE email = 'carla.mendes@email.com';
  SELECT id INTO contact_id1 FROM contacts WHERE email = 'joao.silva@email.com';
  SELECT id INTO contact_id2 FROM contacts WHERE email = 'maria.santos@email.com';

  -- Interações com Lead 1
  INSERT INTO interactions (entity_type, entity_id, interaction_type, subject, content, interaction_date, user_id) VALUES
    ('lead', lead_id1, 'email', 'Bem-vindo!', 'Email de boas-vindas enviado. Apresentação da agência e serviços.', NOW() - INTERVAL '5 days', '22222222-2222-2222-2222-222222222222'),
    ('lead', lead_id1, 'call', 'Primeira chamada', 'Contacto telefónico realizado. Cliente interessado em apartamentos T2. Marcar visita.', NOW() - INTERVAL '4 days', '22222222-2222-2222-2222-222222222222'),
    ('lead', lead_id1, 'whatsapp', 'Envio de opções', 'Enviadas 3 opções de apartamentos via WhatsApp. Cliente gostou muito da opção em Benfica.', NOW() - INTERVAL '2 days', '22222222-2222-2222-2222-222222222222');

  -- Interações com Lead 2
  INSERT INTO interactions (entity_type, entity_id, interaction_type, subject, content, interaction_date, user_id) VALUES
    ('lead', lead_id2, 'meeting', 'Reunião inicial', 'Reunião no escritório. Cliente muito interessado. Budget confirmado.', NOW() - INTERVAL '10 days', '22222222-2222-2222-2222-222222222222'),
    ('lead', lead_id2, 'visit', 'Visita a propriedade', 'Visita à Moradia em Cascais. Cliente adorou! Pediu segunda visita.', NOW() - INTERVAL '7 days', '22222222-2222-2222-2222-222222222222'),
    ('lead', lead_id2, 'email', 'Proposta enviada', 'Proposta formal enviada por email. Aguardar resposta até sexta.', NOW() - INTERVAL '3 days', '22222222-2222-2222-2222-222222222222');

  -- Interações com Contacto 1
  INSERT INTO interactions (entity_type, entity_id, interaction_type, subject, content, interaction_date, user_id) VALUES
    ('contact', contact_id1, 'call', 'Follow-up', 'Chamada de follow-up. Cliente ainda procura. Enviar mais opções.', NOW() - INTERVAL '15 days', '22222222-2222-2222-2222-222222222222'),
    ('contact', contact_id1, 'email', 'Novas opções', 'Enviadas 5 novas opções de apartamentos T2/T3. Cliente vai analisar.', NOW() - INTERVAL '10 days', '22222222-2222-2222-2222-222222222222'),
    ('contact', contact_id1, 'whatsapp', 'Check-in', 'Mensagem de check-in. Cliente agradeceu e pediu mais alguns dias.', NOW() - INTERVAL '5 days', '22222222-2222-2222-2222-222222222222');

  -- Interações com Contacto 2
  INSERT INTO interactions (entity_type, entity_id, interaction_type, subject, content, interaction_date, user_id) VALUES
    ('contact', contact_id2, 'visit', 'Avaliação da propriedade', 'Visita à moradia em Cascais para avaliação. Preço de mercado estimado.', NOW() - INTERVAL '20 days', '33333333-3333-3333-3333-333333333333'),
    ('contact', contact_id2, 'meeting', 'Reunião de estratégia', 'Discutida estratégia de venda. Decidir preço e marketing.', NOW() - INTERVAL '18 days', '33333333-3333-3333-3333-333333333333'),
    ('contact', contact_id2, 'email', 'Contrato de mediação', 'Contrato enviado para assinatura. Urgente!', NOW() - INTERVAL '15 days', '33333333-3333-3333-3333-333333333333');
END $$;

-- =====================================================
-- 6. TASKS (Tarefas de Teste)
-- =====================================================

DO $$
DECLARE
  lead_id1 UUID;
  lead_id2 UUID;
BEGIN
  SELECT id INTO lead_id1 FROM leads WHERE email = 'fernando.nunes@email.com';
  SELECT id INTO lead_id2 FROM leads WHERE email = 'carla.mendes@email.com';

  INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, entity_type, entity_id) VALUES
    -- Tarefas pendentes
    ('Marcar visita com Fernando', 'Agendar visita ao apartamento em Benfica', NOW() + INTERVAL '2 days', 'high', 'pending', '22222222-2222-2222-2222-222222222222', 'lead', lead_id1),
    ('Preparar proposta para Carla', 'Elaborar proposta detalhada para moradia em Cascais', NOW() + INTERVAL '1 day', 'urgent', 'in_progress', '22222222-2222-2222-2222-222222222222', 'lead', lead_id2),
    ('Ligar para João Silva', 'Follow-up sobre opções enviadas. Verificar interesse.', NOW() + INTERVAL '3 days', 'medium', 'pending', '22222222-2222-2222-2222-222222222222', NULL, NULL),
    ('Enviar relatório mensal', 'Compilar vendas e leads do mês', NOW() + INTERVAL '7 days', 'low', 'pending', '33333333-3333-3333-3333-333333333333', NULL, NULL),
    ('Tirar fotos profissionais', 'Agendar fotógrafo para nova moradia', NOW() + INTERVAL '5 days', 'medium', 'pending', '22222222-2222-2222-2222-222222222222', NULL, NULL),
    ('Atualizar anúncios online', 'Renovar anúncios no Idealista e Imovirtual', NOW() + INTERVAL '1 day', 'medium', 'in_progress', '33333333-3333-3333-3333-333333333333', NULL, NULL),

    -- Tarefas concluídas
    ('Email de boas-vindas enviado', 'Primeiro contacto estabelecido', NOW() - INTERVAL '5 days', 'medium', 'completed', '22222222-2222-2222-2222-222222222222', 'lead', lead_id1),
    ('Avaliação concluída', 'Moradia em Cascais avaliada', NOW() - INTERVAL '20 days', 'high', 'completed', '33333333-3333-3333-3333-333333333333', NULL, NULL),
    ('Documentação organizada', 'Todos os certificados reunidos', NOW() - INTERVAL '15 days', 'medium', 'completed', '22222222-2222-2222-2222-222222222222', NULL, NULL),
    ('Reunião com cliente realizada', 'Primeira reunião com sucesso', NOW() - INTERVAL '10 days', 'high', 'completed', '22222222-2222-2222-2222-222222222222', 'lead', lead_id2),
    ('Contrato assinado', 'Mediação acordada', NOW() - INTERVAL '12 days', 'urgent', 'completed', '33333333-3333-3333-3333-333333333333', NULL, NULL),
    ('Anúncio publicado', 'Novo imóvel online em todas as plataformas', NOW() - INTERVAL '8 days', 'medium', 'completed', '22222222-2222-2222-2222-222222222222', NULL, NULL);
END $$;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================

SELECT 'Dados de teste carregados com sucesso!' as status,
       (SELECT COUNT(*) FROM profiles) as profiles,
       (SELECT COUNT(*) FROM contacts) as contacts,
       (SELECT COUNT(*) FROM leads) as leads,
       (SELECT COUNT(*) FROM properties) as properties,
       (SELECT COUNT(*) FROM interactions) as interactions,
       (SELECT COUNT(*) FROM tasks) as tasks;