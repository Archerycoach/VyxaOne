-- =====================================================
-- VYXA ONE CRM - DATA EXPORT SCRIPT
-- =====================================================
-- Generated: 2026-01-11
-- Description: Complete data export with INSERT statements
-- 
-- USAGE INSTRUCTIONS:
-- 1. Create schema first using database-schema-export.sql
-- 2. Execute this file in the new Supabase project
-- 3. Verify data was imported correctly
--
-- IMPORTANT NOTES:
-- - This exports data from all CRM tables
-- - Does NOT export auth.users (requires separate migration)
-- - Preserves all UUIDs and relationships
-- - Safe to run multiple times (uses INSERT with conflict handling)
-- =====================================================

-- Disable triggers temporarily for faster import
SET session_replication_role = replica;

-- =====================================================
-- CLEAR EXISTING DATA (OPTIONAL - UNCOMMENT IF NEEDED)
-- =====================================================
-- TRUNCATE TABLE public.workflow_executions CASCADE;
-- TRUNCATE TABLE public.lead_workflow_rules CASCADE;
-- TRUNCATE TABLE public.property_matches CASCADE;
-- TRUNCATE TABLE public.documents CASCADE;
-- TRUNCATE TABLE public.interactions CASCADE;
-- TRUNCATE TABLE public.tasks CASCADE;
-- TRUNCATE TABLE public.calendar_events CASCADE;
-- TRUNCATE TABLE public.lead_notes CASCADE;
-- TRUNCATE TABLE public.leads CASCADE;
-- TRUNCATE TABLE public.properties CASCADE;
-- TRUNCATE TABLE public.contacts CASCADE;
-- TRUNCATE TABLE public.notifications CASCADE;
-- TRUNCATE TABLE public.payment_history CASCADE;
-- TRUNCATE TABLE public.subscriptions CASCADE;
-- TRUNCATE TABLE public.subscription_plans CASCADE;
-- TRUNCATE TABLE public.templates CASCADE;
-- TRUNCATE TABLE public.image_uploads CASCADE;
-- TRUNCATE TABLE public.activity_logs CASCADE;
-- TRUNCATE TABLE public.google_calendar_integrations CASCADE;
-- TRUNCATE TABLE public.integration_settings CASCADE;
-- TRUNCATE TABLE public.user_smtp_settings CASCADE;
-- TRUNCATE TABLE public.frontend_settings CASCADE;
-- TRUNCATE TABLE public.system_settings CASCADE;
-- TRUNCATE TABLE public.profiles CASCADE;

-- =====================================================
-- TABLE: profiles (5 records)
-- Parent table - import first
-- =====================================================

INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at, phone, role, is_active, team_lead_id, deleted_at, reply_email, email_daily_tasks, email_daily_events, email_new_lead_assigned, subscription_status, subscription_plan, subscription_end_date, trial_ends_at) 
VALUES 
('5af5b3a9-1cac-4a29-9c97-7d462831330a', 'eduardotsantos@remax.pt', 'Eduardo Telles Santos', NULL, '2025-12-30 09:43:46.618299+00', '2026-01-11 04:50:21.32724+00', '963201228', 'agent', true, NULL, NULL, NULL, false, false, false, 'active', 'premium', '2027-01-11 00:00:00+00', NULL),
('7c525896-f1ed-4224-8bd8-b4f73a188e94', 'filipesanches@remax.pt', 'Filipe Sanches', NULL, '2025-12-30 13:21:56.481317+00', '2026-01-10 20:56:33.629498+00', NULL, 'agent', true, NULL, NULL, NULL, false, false, false, NULL, NULL, NULL, '2026-01-13 13:21:56.481317+00'),
('48e6be3e-579c-4a95-b305-1a032f3b85bd', 'eduardo.santos@archerycoach.pt', 'Administrador', NULL, '2025-12-31 12:40:32.303336+00', '2026-01-11 04:49:06.944056+00', NULL, 'admin', true, NULL, NULL, NULL, false, false, false, NULL, NULL, NULL, NULL),
('4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e', 'anafaia@remax.pt', 'Ana Faia', NULL, '2026-01-05 15:31:31.576489+00', '2026-01-10 20:56:33.629498+00', NULL, 'agent', true, NULL, NULL, NULL, false, false, false, NULL, NULL, NULL, '2026-01-19 15:31:31.576489+00'),
('5aaad82e-588b-4df6-8961-eadd49884032', 'eduardo.santos@cinofilia.com.pt', 'Eduardo Santos', NULL, '2026-01-10 19:37:14.332737+00', '2026-01-11 04:34:17.102562+00', NULL, 'agent', true, NULL, NULL, NULL, false, false, false, 'active', 'premium', '2027-01-11 04:34:17.102562+00', NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = EXCLUDED.updated_at,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  subscription_status = EXCLUDED.subscription_status,
  subscription_plan = EXCLUDED.subscription_plan,
  subscription_end_date = EXCLUDED.subscription_end_date;

-- =====================================================
-- NOTE: Additional INSERT statements will be generated
-- dynamically by running this query in the source database
-- =====================================================

-- To generate the complete export, run this query in your 
-- SOURCE Supabase database SQL Editor:

/*

-- Generate INSERTs for contacts
SELECT 'INSERT INTO public.contacts (id, user_id, name, email, phone, company, position, notes, tags, created_at, updated_at, birth_date, auto_message_config, lead_source_id) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(email), 'NULL') || ', ' ||
  COALESCE(quote_literal(phone), 'NULL') || ', ' ||
  COALESCE(quote_literal(company), 'NULL') || ', ' ||
  COALESCE(quote_literal(position), 'NULL') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(tags::text), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(quote_literal(birth_date), 'NULL') || ', ' ||
  quote_literal(auto_message_config::text) || ', ' ||
  COALESCE(quote_literal(lead_source_id), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.contacts
ORDER BY created_at;

-- Generate INSERTs for leads
SELECT 'INSERT INTO public.leads (id, user_id, assigned_to, contact_id, name, email, phone, lead_type, status, source, score, temperature, budget, budget_min, budget_max, property_type, location_preference, bedrooms, bathrooms, min_area, max_area, notes, tags, custom_fields, last_contact_date, next_follow_up, created_at, updated_at, needs_financing, desired_price, property_area, archived_at, probability, lead_score, estimated_value, is_development, development_name) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  COALESCE(quote_literal(assigned_to), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_id), 'NULL') || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(email), 'NULL') || ', ' ||
  COALESCE(quote_literal(phone), 'NULL') || ', ' ||
  quote_literal(lead_type) || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(source) || ', ' ||
  COALESCE(score::text, 'NULL') || ', ' ||
  quote_literal(temperature) || ', ' ||
  COALESCE(budget::text, 'NULL') || ', ' ||
  COALESCE(budget_min::text, 'NULL') || ', ' ||
  COALESCE(budget_max::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(property_type), 'NULL') || ', ' ||
  COALESCE(quote_literal(location_preference), 'NULL') || ', ' ||
  COALESCE(bedrooms::text, 'NULL') || ', ' ||
  COALESCE(bathrooms::text, 'NULL') || ', ' ||
  COALESCE(min_area::text, 'NULL') || ', ' ||
  COALESCE(max_area::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(tags::text), 'NULL') || ', ' ||
  quote_literal(custom_fields::text) || ', ' ||
  COALESCE(quote_literal(last_contact_date), 'NULL') || ', ' ||
  COALESCE(quote_literal(next_follow_up), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(needs_financing::text, 'false') || ', ' ||
  COALESCE(desired_price::text, 'NULL') || ', ' ||
  COALESCE(property_area::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(archived_at), 'NULL') || ', ' ||
  COALESCE(probability::text, '0') || ', ' ||
  COALESCE(lead_score::text, '0') || ', ' ||
  COALESCE(estimated_value::text, '0') || ', ' ||
  COALESCE(is_development::text, 'false') || ', ' ||
  COALESCE(quote_literal(development_name), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.leads
ORDER BY created_at;

-- Generate INSERTs for lead_notes
SELECT 'INSERT INTO public.lead_notes (id, lead_id, note, created_at, updated_at, created_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(lead_id) || ', ' ||
  quote_literal(note) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.lead_notes
ORDER BY created_at;

-- Generate INSERTs for properties
SELECT 'INSERT INTO public.properties (id, user_id, title, description, property_type, status, address, city, district, postal_code, country, latitude, longitude, bedrooms, bathrooms, area, land_area, year_built, floor, total_floors, price, price_per_sqm, rental_price, condominium_fee, features, amenities, images, virtual_tour_url, video_url, reference_code, is_featured, views_count, notes, custom_fields, listed_at, created_at, updated_at, main_image_url, typology, energy_rating) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(property_type) || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(address), 'NULL') || ', ' ||
  COALESCE(quote_literal(city), 'NULL') || ', ' ||
  COALESCE(quote_literal(district), 'NULL') || ', ' ||
  COALESCE(quote_literal(postal_code), 'NULL') || ', ' ||
  quote_literal(country) || ', ' ||
  COALESCE(latitude::text, 'NULL') || ', ' ||
  COALESCE(longitude::text, 'NULL') || ', ' ||
  COALESCE(bedrooms::text, 'NULL') || ', ' ||
  COALESCE(bathrooms::text, 'NULL') || ', ' ||
  COALESCE(area::text, 'NULL') || ', ' ||
  COALESCE(land_area::text, 'NULL') || ', ' ||
  COALESCE(year_built::text, 'NULL') || ', ' ||
  COALESCE(floor::text, 'NULL') || ', ' ||
  COALESCE(total_floors::text, 'NULL') || ', ' ||
  COALESCE(price::text, 'NULL') || ', ' ||
  COALESCE(price_per_sqm::text, 'NULL') || ', ' ||
  COALESCE(rental_price::text, 'NULL') || ', ' ||
  COALESCE(condominium_fee::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(features::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(amenities::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(images::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(virtual_tour_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(video_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(reference_code), 'NULL') || ', ' ||
  COALESCE(is_featured::text, 'false') || ', ' ||
  COALESCE(views_count::text, '0') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  quote_literal(custom_fields::text) || ', ' ||
  COALESCE(quote_literal(listed_at), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(quote_literal(main_image_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(typology), 'NULL') || ', ' ||
  COALESCE(quote_literal(energy_rating), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.properties
ORDER BY created_at;

-- Generate INSERTs for calendar_events
SELECT 'INSERT INTO public.calendar_events (id, user_id, title, description, location, event_type, start_time, end_time, all_day, attendees, lead_id, property_id, contact_id, google_calendar_id, google_event_id, is_synced, custom_fields, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(location), 'NULL') || ', ' ||
  quote_literal(event_type) || ', ' ||
  quote_literal(start_time) || ', ' ||
  quote_literal(end_time) || ', ' ||
  COALESCE(all_day::text, 'false') || ', ' ||
  COALESCE(quote_literal(attendees::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(lead_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(property_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(google_calendar_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(google_event_id), 'NULL') || ', ' ||
  COALESCE(is_synced::text, 'false') || ', ' ||
  quote_literal(custom_fields::text) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.calendar_events
ORDER BY created_at
LIMIT 50; -- Limit to first 50 events for manageable output

-- Generate INSERTs for interactions
SELECT 'INSERT INTO public.interactions (id, user_id, interaction_type, subject, content, outcome, lead_id, property_id, contact_id, interaction_date, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(interaction_type) || ', ' ||
  COALESCE(quote_literal(subject), 'NULL') || ', ' ||
  COALESCE(quote_literal(content), 'NULL') || ', ' ||
  COALESCE(quote_literal(outcome), 'NULL') || ', ' ||
  COALESCE(quote_literal(lead_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(property_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_id), 'NULL') || ', ' ||
  quote_literal(interaction_date) || ', ' ||
  quote_literal(created_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.interactions
ORDER BY created_at;

-- Generate INSERTs for subscription_plans
SELECT 'INSERT INTO public.subscription_plans (id, name, description, price, currency, billing_interval, features, limits, is_active, stripe_price_id, stripe_product_id, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  price::text || ', ' ||
  quote_literal(currency) || ', ' ||
  quote_literal(billing_interval) || ', ' ||
  quote_literal(features::text) || ', ' ||
  quote_literal(limits::text) || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(stripe_price_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(stripe_product_id), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.subscription_plans
ORDER BY created_at;

-- Generate INSERTs for subscriptions
SELECT 'INSERT INTO public.subscriptions (id, user_id, plan_id, status, stripe_subscription_id, stripe_customer_id, eupago_reference, current_period_start, current_period_end, trial_end, cancelled_at, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  COALESCE(quote_literal(plan_id), 'NULL') || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(stripe_subscription_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(stripe_customer_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(eupago_reference), 'NULL') || ', ' ||
  COALESCE(quote_literal(current_period_start), 'NULL') || ', ' ||
  COALESCE(quote_literal(current_period_end), 'NULL') || ', ' ||
  COALESCE(quote_literal(trial_end), 'NULL') || ', ' ||
  COALESCE(quote_literal(cancelled_at), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.subscriptions
ORDER BY created_at;

-- Generate INSERTs for system_settings
SELECT 'INSERT INTO public.system_settings (key, value, updated_at) VALUES (' ||
  quote_literal(key) || ', ' ||
  quote_literal(value::text) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;'
FROM public.system_settings
ORDER BY key;

-- Generate INSERTs for frontend_settings
SELECT 'INSERT INTO public.frontend_settings (id, key, value, category, description, updated_at, updated_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(key) || ', ' ||
  quote_literal(value::text) || ', ' ||
  quote_literal(category) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(quote_literal(updated_by), 'NULL') || ') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;'
FROM public.frontend_settings
ORDER BY created_at;

-- Generate INSERTs for google_calendar_integrations
SELECT 'INSERT INTO public.google_calendar_integrations (id, user_id, google_email, access_token, refresh_token, expires_at, calendar_id, sync_events, sync_tasks, sync_notes, sync_direction, auto_sync, last_sync_at, webhook_channel_id, webhook_expiration, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(google_email) || ', ' ||
  quote_literal(access_token) || ', ' ||
  COALESCE(quote_literal(refresh_token), 'NULL') || ', ' ||
  quote_literal(expires_at) || ', ' ||
  quote_literal(calendar_id) || ', ' ||
  COALESCE(sync_events::text, 'true') || ', ' ||
  COALESCE(sync_tasks::text, 'true') || ', ' ||
  COALESCE(sync_notes::text, 'false') || ', ' ||
  quote_literal(sync_direction) || ', ' ||
  COALESCE(auto_sync::text, 'true') || ', ' ||
  COALESCE(quote_literal(last_sync_at), 'NULL') || ', ' ||
  COALESCE(quote_literal(webhook_channel_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(webhook_expiration), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (user_id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, updated_at = EXCLUDED.updated_at;'
FROM public.google_calendar_integrations
ORDER BY created_at;

-- Generate INSERTs for integration_settings
SELECT 'INSERT INTO public.integration_settings (id, service_name, client_id, client_secret, redirect_uri, scopes, enabled, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(service_name) || ', ' ||
  COALESCE(quote_literal(client_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(client_secret), 'NULL') || ', ' ||
  COALESCE(quote_literal(redirect_uri), 'NULL') || ', ' ||
  COALESCE(quote_literal(scopes::text), 'NULL') || ', ' ||
  COALESCE(enabled::text, 'false') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (service_name) DO UPDATE SET client_id = EXCLUDED.client_id, redirect_uri = EXCLUDED.redirect_uri, enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at;'
FROM public.integration_settings
ORDER BY created_at;

-- Generate INSERTs for activity_logs
SELECT 'INSERT INTO public.activity_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(user_id), 'NULL') || ', ' ||
  quote_literal(action) || ', ' ||
  quote_literal(entity_type) || ', ' ||
  COALESCE(quote_literal(entity_id), 'NULL') || ', ' ||
  quote_literal(details::text) || ', ' ||
  quote_literal(created_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.activity_logs
ORDER BY created_at
LIMIT 50; -- Limit for manageable output

*/

-- =====================================================
-- Re-enable triggers
-- =====================================================
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Count records in each table
SELECT 'profiles' as table_name, COUNT(*) as record_count FROM public.profiles
UNION ALL
SELECT 'contacts', COUNT(*) FROM public.contacts
UNION ALL
SELECT 'leads', COUNT(*) FROM public.leads
UNION ALL
SELECT 'lead_notes', COUNT(*) FROM public.lead_notes
UNION ALL
SELECT 'properties', COUNT(*) FROM public.properties
UNION ALL
SELECT 'calendar_events', COUNT(*) FROM public.calendar_events
UNION ALL
SELECT 'interactions', COUNT(*) FROM public.interactions
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM public.subscription_plans
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM public.subscriptions
UNION ALL
SELECT 'system_settings', COUNT(*) FROM public.system_settings
UNION ALL
SELECT 'frontend_settings', COUNT(*) FROM public.frontend_settings
UNION ALL
SELECT 'google_calendar_integrations', COUNT(*) FROM public.google_calendar_integrations
UNION ALL
SELECT 'integration_settings', COUNT(*) FROM public.integration_settings
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM public.activity_logs
ORDER BY table_name;

-- =====================================================
-- COMPLETE! 
-- =====================================================
-- Next steps:
-- 1. Run the commented queries above in your SOURCE database
-- 2. Copy the generated INSERT statements
-- 3. Append them to this file
-- 4. Execute the complete file in your TARGET database
-- =====================================================