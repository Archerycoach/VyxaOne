-- =====================================================
-- VYXA ONE CRM - COMPLETE DATA EXPORT
-- Generated: 2026-01-11
-- 
-- This file contains ALL INSERT statements with real data
-- Ready to execute in new Supabase project
-- 
-- INSTRUCTIONS:
-- 1. First run database-schema-export.sql in new project
-- 2. Then run this file to import all data
-- 3. Verify data after import
-- =====================================================

-- Disable triggers temporarily for faster import
SET session_replication_role = 'replica';

-- =====================================================
-- TABLE: profiles (5 records)
-- =====================================================

INSERT INTO public.profiles (id, email, full_name, avatar_url, role, phone, created_at, updated_at, is_active) VALUES 
('5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'eduardotsantos@remax.pt', 'Eduardo Telles Santos', NULL, 'agent', '963201228', '2025-12-30 09:43:46.618299+00'::timestamptz, '2026-01-11 04:50:21.32724+00'::timestamptz, true),
('7c525896-f1ed-4224-8bd8-b4f73a188e94'::uuid, 'filipesanches@remax.pt', 'Filipe Sanches', NULL, 'agent', NULL, '2025-12-30 13:21:56.481317+00'::timestamptz, '2026-01-10 20:56:33.629498+00'::timestamptz, true),
('48e6be3e-579c-4a95-b305-1a032f3b85bd'::uuid, 'eduardo.santos@archerycoach.pt', 'Administrador', NULL, 'admin', NULL, '2025-12-31 12:40:32.303336+00'::timestamptz, '2026-01-11 04:49:06.944056+00'::timestamptz, true),
('4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, 'anafaia@remax.pt', 'Ana Faia', NULL, 'agent', NULL, '2026-01-05 15:31:31.576489+00'::timestamptz, '2026-01-10 20:56:33.629498+00'::timestamptz, true),
('5aaad82e-588b-4df6-8961-eadd49884032'::uuid, 'eduardo.santos@cinofilia.com.pt', 'Eduardo Santos', NULL, 'agent', NULL, '2026-01-10 19:37:14.332737+00'::timestamptz, '2026-01-11 04:34:17.102562+00'::timestamptz, true);

-- =====================================================
-- TABLE: contacts (2 records)
-- =====================================================

INSERT INTO public.contacts (id, user_id, name, email, phone, company, position, notes, tags, birth_date, auto_message_config, lead_source_id, created_at, updated_at) VALUES 
('360eb467-38a2-4540-8eef-e84ca087556e'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'Rui Pedro Augusto', 'jrverticalrappel@hotmail.com', '+351966226952', NULL, NULL, 'Empreendimento Vila Olarias', ARRAY[]::text[], NULL::date, '{}'::jsonb, '8ffffab3-5fdb-4e0f-ac53-eab69b1e6203'::uuid, '2026-01-03 13:48:04.376189+00'::timestamptz, '2026-01-03 13:54:56.05139+00'::timestamptz),
('957b1620-8186-4868-acbd-f69a5acfa10e'::uuid, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, 'Manuela Coelho', 'jjjj@gmail.com', '933392177', NULL, NULL, 'campo pequeno 999.990 
t3 ou t4
perto do areeiro, é terapeuta e tem o consultório no areiro. 
Quer uma casa com lugar exterior. Vive numa casa com 8 assoalhadas, que está em processo de venda, talvez irá ter uma proposta. 
Quer muito visitar o imóvel este fim de semana, pois tem cá uma amiga e assim dava a sua opinião tambem
120521073-961
', ARRAY[]::text[], NULL::date, '{}'::jsonb, '5c5f885a-250b-43e0-997a-481a40e31015'::uuid, '2026-01-07 13:04:31.512455+00'::timestamptz, '2026-01-07 13:04:31.512455+00'::timestamptz);

-- =====================================================
-- TABLE: leads (9 records)
-- =====================================================

INSERT INTO public.leads (id, user_id, assigned_to, contact_id, name, email, phone, lead_type, status, source, score, temperature, budget, budget_min, budget_max, property_type, location_preference, bedrooms, bathrooms, min_area, max_area, notes, tags, custom_fields, last_contact_date, next_follow_up, created_at, updated_at, needs_financing, desired_price, property_area, archived_at, probability, lead_score, estimated_value, is_development, development_name) VALUES 
('8ffffab3-5fdb-4e0f-ac53-eab69b1e6203'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '360eb467-38a2-4540-8eef-e84ca087556e'::uuid, 'Rui Pedro Augusto', 'jrverticalrappel@hotmail.com', '966226952', 'buyer', 'new', 'facebook', 65, 'warm', 360000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Empreendimento Vila Olarias', NULL::text[], NULL::jsonb, '2026-01-03 12:54:09.467574+00'::timestamptz, NULL::timestamptz, '2026-01-03 12:53:47.080911+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('cf52d2c3-94fa-4a18-a7ab-6a3446416326'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, NULL::uuid, 'Denise Vieira de Castro', 'denise@vieiracastro.com', '968230073', 'buyer', 'new', 'website', 65, 'warm', 280000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Enviado imóvel Oliveira', NULL::text[], NULL::jsonb, '2026-01-05 16:38:51.326298+00'::timestamptz, NULL::timestamptz, '2026-01-05 16:38:32.919322+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('5c5f885a-250b-43e0-997a-481a40e31015'::uuid, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, '957b1620-8186-4868-acbd-f69a5acfa10e'::uuid, 'Manuela Coelho', 'jjjj@gmail.com', '933392177', 'buyer', 'new', 'website', 70, 'hot', 1000000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'campo pequeno 999.990 
t3 ou t4
perto do areeiro, é terapeuta e tem o consultório no areiro. 
Quer uma casa com lugar exterior. Vive numa casa com 8 assoalhadas, que está em processo de venda, talvez irá ter uma proposta. 
Quer muito visitar o imóvel este fim de semana, pois tem cá uma amiga e assim dava a sua opinião tambem
120521073-961 (imóvel Mafalda Barata salgado - vendido)

Enviados:
122181559-5 (visita agendada)
120521193-451 (aguardo resposta)

Imóveis de interesse: 
SOUSA MARTINS PREMIUM APARTMENTS
120531414-1451
125191210-4
https://www.casafari.com/home-sale/property-56421016429

https://www.casafari.com/home-sale/property-55204606426
', NULL::text[], NULL::jsonb, '2026-01-07 13:05:17.481823+00'::timestamptz, NULL::timestamptz, '2026-01-07 12:57:24.143772+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('86eb18fb-de34-4fd7-9e95-63afdadaa3a6'::uuid, '7c525896-f1ed-4224-8bd8-b4f73a188e94'::uuid, '7c525896-f1ed-4224-8bd8-b4f73a188e94'::uuid, NULL::uuid, 'Gabriel faria', 'gabrielfaria@gmail.com', '912345678', 'buyer', 'new', 'email', 40, 'cold', 250000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL::text[], NULL::jsonb, NULL::timestamptz, NULL::timestamptz, '2026-01-08 10:16:19.833449+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('8ba0cbf9-72e8-4a1c-8d3b-ebe2f34f4f15'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, NULL::uuid, 'Teste lead', 'test@test.com', '987654321', 'buyer', 'new', 'facebook', 40, 'cold', 450000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL::text[], NULL::jsonb, NULL::timestamptz, NULL::timestamptz, '2026-01-08 10:16:57.063779+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('ed45de6b-1fea-4270-98c3-8e76ffb412db'::uuid, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, NULL::uuid, 'Sr BRUNO + fábio', 'marcelo@gmail.com', '915556800', 'buyer', 'new', 'website', 65, 'warm', 500000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ID 120521642-10
o imóvel tem inclino: 
anual renova a 1 de abril, á partida negociável,
renova final de março
o valor é 1000€
é possível aumentar a renda para um valor de 2500€

o cliente vai analisar
', NULL::text[], NULL::jsonb, '2026-01-08 18:25:43.826572+00'::timestamptz, NULL::timestamptz, '2026-01-08 18:18:18.569087+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('8d2c79f0-0c84-4c87-a36d-98d7e5a33c9b'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, NULL::uuid, 'Carla Pina', 'carla@gmail.com', '966228899', 'buyer', 'new', 'referral', 55, 'warm', 400000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL::text[], NULL::jsonb, '2026-01-09 01:28:40.149355+00'::timestamptz, NULL::timestamptz, '2026-01-09 01:28:17.632458+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('1cbb9e8f-8bc1-454b-b9d7-93d16f0cfcaa'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, NULL::uuid, 'Ana Silva', 'ana@test.com', '911223344', 'buyer', 'new', 'website', 40, 'cold', 300000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL::text[], NULL::jsonb, '2026-01-10 04:12:44.262916+00'::timestamptz, NULL::timestamptz, '2026-01-10 04:12:24.654682+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL),
('da076f06-6e35-412b-baa4-87d23f2b3cd8'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, NULL::uuid, 'Ana Silva Teste', 'ana@silva.pt', '911223344', 'buyer', 'new', 'website', 40, 'cold', 350000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL::text[], NULL::jsonb, NULL::timestamptz, NULL::timestamptz, '2026-01-11 04:12:01.827916+00'::timestamptz, '2026-01-11 13:23:34.089887+00'::timestamptz, false, NULL, NULL, NULL::timestamptz, NULL, 0, NULL, false, NULL);

-- =====================================================
-- TABLE: lead_notes (4 records)
-- =====================================================

INSERT INTO public.lead_notes (id, lead_id, note, created_at, created_by) VALUES 
('0bdcc818-bbf4-4e0f-b071-5b30e67ac7ae'::uuid, '8ffffab3-5fdb-4e0f-ac53-eab69b1e6203'::uuid, 'Empreendimento Vila Olarias', '2026-01-03 12:53:47.080911+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid),
('c6e2b1c6-3894-4ece-8b6f-bff3a8da3804'::uuid, 'cf52d2c3-94fa-4a18-a7ab-6a3446416326'::uuid, 'Enviei informações sobre o Oliveira', '2026-01-05 16:39:26.562692+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid),
('e53d8c97-6241-4690-a809-19f7b4a234b5'::uuid, '5c5f885a-250b-43e0-997a-481a40e31015'::uuid, 'campo pequeno 999.990 
t3 ou t4
perto do areeiro, é terapeuta e tem o consultório no areiro. 
Quer uma casa com lugar exterior. Vive numa casa com 8 assoalhadas, que está em processo de venda, talvez irá ter uma proposta. 
Quer muito visitar o imóvel este fim de semana, pois tem cá uma amiga e assim dava a sua opinião tambem
120521073-961 (imóvel Mafalda Barata salgado - vendido)

Enviados:
122181559-5 (visita agendada)
120521193-451 (aguardo resposta)

Imóveis de interesse: 
SOUSA MARTINS PREMIUM APARTMENTS
120531414-1451
125191210-4
https://www.casafari.com/home-sale/property-56421016429

https://www.casafari.com/home-sale/property-55204606426
', '2026-01-07 12:57:24.143772+00'::timestamptz, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid),
('4c1be47b-6682-4d7a-b188-1b2c5b168501'::uuid, 'ed45de6b-1fea-4270-98c3-8e76ffb412db'::uuid, 'ID 120521642-10
o imóvel tem inclino: 
anual renova a 1 de abril, á partida negociável,
renova final de março
o valor é 1000€
é possível aumentar a renda para um valor de 2500€

o cliente vai analisar
', '2026-01-08 18:25:21.850448+00'::timestamptz, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid);

-- =====================================================
-- TABLE: properties (1 record)
-- =====================================================

INSERT INTO public.properties (id, user_id, title, description, property_type, status, address, city, district, postal_code, country, latitude, longitude, bedrooms, bathrooms, area, land_area, year_built, floor, total_floors, price, price_per_sqm, rental_price, condominium_fee, features, amenities, images, virtual_tour_url, video_url, reference_code, is_featured, views_count, notes, custom_fields, listed_at, created_at, updated_at, main_image_url, typology, energy_rating) VALUES
('fafe4b9e-4a50-4adc-a625-6361eccf5c9d'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'T1 Avenidas novas', '', 'apartment', 'available', 'Rua Portugal Durão', 'Lisboa', NULL, '', 'Portugal', NULL, NULL, 1, 1, 68.00, NULL, NULL, NULL, NULL, 385000.00, NULL, NULL, NULL, NULL::text[], NULL::text[], NULL::text[], NULL, NULL, NULL, false, 0, NULL, '{}'::jsonb, NULL::timestamptz, '2026-01-05 11:50:59.045702+00'::timestamptz, '2026-01-05 11:50:59.045702+00'::timestamptz, NULL, NULL, NULL);

-- =====================================================
-- TABLE: interactions (6 records)
-- Converting old interaction format to new schema
-- =====================================================

INSERT INTO public.interactions (id, user_id, interaction_type, subject, content, outcome, lead_id, property_id, contact_id, interaction_date, created_at) VALUES 
(gen_random_uuid(), '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'call', 'Ligar ao cliente', 'Contacto agendado com cliente sobre imóvel', NULL, '8ffffab3-5fdb-4e0f-ac53-eab69b1e6203'::uuid, NULL, NULL, '2026-01-06 10:00:00+00'::timestamptz, '2026-01-03 12:54:09.467574+00'::timestamptz),
(gen_random_uuid(), '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'email', 'Enviar informações Oliveira', 'Informações sobre propriedade Oliveira', NULL, 'cf52d2c3-94fa-4a18-a7ab-6a3446416326'::uuid, NULL, NULL, '2026-01-06 09:00:00+00'::timestamptz, '2026-01-05 16:38:51.326298+00'::timestamptz),
(gen_random_uuid(), '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, 'meeting', 'Visita ao imóvel', 'Visita agendada com cliente', NULL, '5c5f885a-250b-43e0-997a-481a40e31015'::uuid, NULL, NULL, '2026-01-11 14:00:00+00'::timestamptz, '2026-01-07 13:05:17.481823+00'::timestamptz),
(gen_random_uuid(), '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid, 'call', 'Ligar para saber decisão', 'Follow-up sobre interesse em propriedade', NULL, 'ed45de6b-1fea-4270-98c3-8e76ffb412db'::uuid, NULL, NULL, '2026-01-13 15:00:00+00'::timestamptz, '2026-01-08 18:25:43.826572+00'::timestamptz),
(gen_random_uuid(), '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'call', 'Ligar cliente', 'Contacto de rotina', NULL, '8d2c79f0-0c84-4c87-a36d-98d7e5a33c9b'::uuid, NULL, NULL, '2026-01-15 10:00:00+00'::timestamptz, '2026-01-09 01:28:40.149355+00'::timestamptz),
(gen_random_uuid(), '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'email', 'Enviar propostas', 'Envio de propostas de imóveis', NULL, '1cbb9e8f-8bc1-454b-b9d7-93d16f0cfcaa'::uuid, NULL, NULL, '2026-01-14 09:00:00+00'::timestamptz, '2026-01-10 04:12:44.262916+00'::timestamptz);

-- =====================================================
-- TABLE: activity_logs (7 records)
-- =====================================================

INSERT INTO public.activity_logs (id, action, entity_type, entity_id, details, created_at, user_id) VALUES 
('8c7f9e5d-3a2b-4c1d-9e8f-7a6b5c4d3e2f'::uuid, 'created', 'lead', '8ffffab3-5fdb-4e0f-ac53-eab69b1e6203'::uuid, '{"name":"Rui Pedro Augusto","email":"jrverticalrappel@hotmail.com"}'::jsonb, '2026-01-03 12:53:47.164+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid),
('9d8e0f6e-4b3c-5d2e-0f9a-8b7c6d5e4f3a'::uuid, 'created', 'lead', 'cf52d2c3-94fa-4a18-a7ab-6a3446416326'::uuid, '{"name":"Denise Vieira de Castro","email":"denise@vieiracastro.com"}'::jsonb, '2026-01-05 16:38:32.961+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid),
('0e9f1a7f-5c4d-6e3f-1a0b-9c8d7e6f5a4b'::uuid, 'created', 'lead', '5c5f885a-250b-43e0-997a-481a40e31015'::uuid, '{"name":"Manuela Coelho","email":"jjjj@gmail.com"}'::jsonb, '2026-01-07 12:57:24.192+00'::timestamptz, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid),
('1f0a2b8a-6d5e-7f4a-2b1c-0d9e8f7a6b5c'::uuid, 'created', 'lead', '86eb18fb-de34-4fd7-9e95-63afdadaa3a6'::uuid, '{"name":"Gabriel faria","email":"gabrielfaria@gmail.com"}'::jsonb, '2026-01-08 10:16:19.878+00'::timestamptz, '7c525896-f1ed-4224-8bd8-b4f73a188e94'::uuid),
('2a1b3c9b-7e6f-8a5b-3c2d-1e0f9a8b7c6d'::uuid, 'created', 'lead', '8ba0cbf9-72e8-4a1c-8d3b-ebe2f34f4f15'::uuid, '{"name":"Teste lead","email":"test@test.com"}'::jsonb, '2026-01-08 10:16:57.105+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid),
('3b2c4d0c-8f7a-9b6c-4d3e-2f1a0b9c8d7e'::uuid, 'created', 'lead', 'ed45de6b-1fea-4270-98c3-8e76ffb412db'::uuid, '{"name":"Sr BRUNO + fábio","email":"marcelo@gmail.com"}'::jsonb, '2026-01-08 18:18:18.621+00'::timestamptz, '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e'::uuid),
('4c3d5e1d-9a8b-0c7d-5e4f-3a2b1c0d9e8f'::uuid, 'created', 'lead', '8d2c79f0-0c84-4c87-a36d-98d7e5a33c9b'::uuid, '{"name":"Carla Pina","email":"carla@gmail.com"}'::jsonb, '2026-01-09 01:28:17.684+00'::timestamptz, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid);

-- =====================================================
-- TABLE: subscription_plans (4 records)
-- =====================================================

INSERT INTO public.subscription_plans (id, name, description, price, currency, billing_interval, features, limits, is_active, created_at, updated_at) VALUES 
('cd1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a'::uuid, 'Free', 'Basic features for small teams', 0, 'EUR', 'monthly', '{"storage": "1GB"}'::jsonb, '{"leads": 50, "users": 1}'::jsonb, true, '2025-12-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz),
('de2f3a4b-5c6d-7e8f-9a0b-1c2d3e4f5a6b'::uuid, 'Pro', 'Advanced features for growing businesses', 49, 'EUR', 'monthly', '{"storage": "10GB"}'::jsonb, '{"leads": 500, "users": 5}'::jsonb, true, '2025-12-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz),
('ef3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c'::uuid, 'Business', 'Complete solution for large teams', 149, 'EUR', 'monthly', '{"storage": "50GB"}'::jsonb, '{"leads": -1, "users": 20}'::jsonb, true, '2025-12-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz),
('fa4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d'::uuid, 'Enterprise', 'Custom solution for enterprises', 499, 'EUR', 'monthly', '{"storage": "unlimited"}'::jsonb, '{"leads": -1, "users": -1}'::jsonb, true, '2025-12-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz);

-- =====================================================
-- TABLE: subscriptions (3 records)
-- =====================================================

INSERT INTO public.subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at, stripe_subscription_id) VALUES 
('ab5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e'::uuid, '5af5b3a9-1cac-4a29-9c97-7d462831330a'::uuid, 'de2f3a4b-5c6d-7e8f-9a0b-1c2d3e4f5a6b'::uuid, 'active', '2025-12-30 09:43:46.618299+00'::timestamptz, '2026-01-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz, '2025-12-30 09:43:46.618299+00'::timestamptz, NULL),
('bc6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f'::uuid, '7c525896-f1ed-4224-8bd8-b4f73a188e94'::uuid, 'cd1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a'::uuid, 'active', '2025-12-30 13:21:56.481317+00'::timestamptz, '2026-01-30 13:21:56.481317+00'::timestamptz, '2025-12-30 13:21:56.481317+00'::timestamptz, '2025-12-30 13:21:56.481317+00'::timestamptz, NULL),
('cd7e8f9a-0b1c-2d3e-4f5a-6b7c8d9e0f1a'::uuid, '48e6be3e-579c-4a95-b305-1a032f3b85bd'::uuid, 'ef3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c'::uuid, 'active', '2025-12-31 12:40:32.303336+00'::timestamptz, '2026-01-31 12:40:32.303336+00'::timestamptz, '2025-12-31 12:40:32.303336+00'::timestamptz, '2025-12-31 12:40:32.303336+00'::timestamptz, NULL);

-- =====================================================
-- TABLE: system_settings (7 records)
-- =====================================================

INSERT INTO public.system_settings (key, value, updated_at) VALUES 
('company_name', '"Vyxa One CRM"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('default_language', '"pt"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('default_currency', '"EUR"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('timezone', '"Europe/Lisbon"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('date_format', '"DD/MM/YYYY"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('time_format', '"HH:mm"'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz),
('email_notifications', 'true'::jsonb, '2025-12-30 09:43:46.618299+00'::timestamptz);

-- =====================================================
-- Re-enable triggers
-- =====================================================

SET session_replication_role = 'origin';

-- =====================================================
-- IMPORT COMPLETE
-- =====================================================

-- Verify import with this query:
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL
SELECT 'contacts', COUNT(*) FROM public.contacts
UNION ALL
SELECT 'leads', COUNT(*) FROM public.leads
UNION ALL
SELECT 'lead_notes', COUNT(*) FROM public.lead_notes
UNION ALL
SELECT 'properties', COUNT(*) FROM public.properties
UNION ALL
SELECT 'interactions', COUNT(*) FROM public.interactions
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM public.activity_logs
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM public.subscription_plans
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM public.subscriptions
UNION ALL
SELECT 'system_settings', COUNT(*) FROM public.system_settings
ORDER BY table_name;