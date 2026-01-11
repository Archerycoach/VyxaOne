-- =====================================================
-- VYXA ONE CRM - DATABASE CLEANUP
-- Generated: 2026-01-11
-- 
-- This script DELETES all data from all tables
-- while preserving the table structure (schema)
-- 
-- INSTRUCTIONS:
-- 1. Run this script FIRST to clean all existing data
-- 2. Then run database-complete-data-export.sql to import fresh data
-- 
-- ⚠️ WARNING: This will DELETE ALL DATA from your database!
-- ⚠️ Schema/structure is preserved, only data is deleted
-- =====================================================

-- Start transaction for safety
BEGIN;

-- Disable triggers temporarily for faster cleanup
SET session_replication_role = 'replica';

-- =====================================================
-- DELETE DATA IN CORRECT ORDER (respecting foreign keys)
-- Based on database-schema-export.sql
-- =====================================================

-- Child tables first (tables with foreign keys)
DELETE FROM public.activity_logs;
DELETE FROM public.interactions;
DELETE FROM public.lead_notes;
DELETE FROM public.calendar_events;
DELETE FROM public.tasks;
DELETE FROM public.property_matches;
DELETE FROM public.subscriptions;
DELETE FROM public.payment_history;
DELETE FROM public.image_uploads;
DELETE FROM public.documents;
DELETE FROM public.templates;
DELETE FROM public.lead_workflow_rules;
DELETE FROM public.workflow_executions;
DELETE FROM public.notifications;
DELETE FROM public.integration_settings;
DELETE FROM public.google_calendar_integrations;
DELETE FROM public.user_smtp_settings;

-- Parent tables (tables referenced by foreign keys)
DELETE FROM public.contacts;
DELETE FROM public.leads;
DELETE FROM public.properties;
DELETE FROM public.profiles;

-- Configuration tables (no foreign keys)
DELETE FROM public.subscription_plans;
DELETE FROM public.system_settings;
DELETE FROM public.frontend_settings;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =====================================================
-- VERIFICATION QUERY
-- Run this to confirm all tables are empty
-- =====================================================

SELECT 
  'profiles' as table_name, COUNT(*) as remaining_records FROM public.profiles
UNION ALL
SELECT 'contacts', COUNT(*) FROM public.contacts
UNION ALL
SELECT 'leads', COUNT(*) FROM public.leads
UNION ALL
SELECT 'lead_notes', COUNT(*) FROM public.lead_notes
UNION ALL
SELECT 'properties', COUNT(*) FROM public.properties
UNION ALL
SELECT 'property_matches', COUNT(*) FROM public.property_matches
UNION ALL
SELECT 'calendar_events', COUNT(*) FROM public.calendar_events
UNION ALL
SELECT 'tasks', COUNT(*) FROM public.tasks
UNION ALL
SELECT 'interactions', COUNT(*) FROM public.interactions
UNION ALL
SELECT 'documents', COUNT(*) FROM public.documents
UNION ALL
SELECT 'templates', COUNT(*) FROM public.templates
UNION ALL
SELECT 'lead_workflow_rules', COUNT(*) FROM public.lead_workflow_rules
UNION ALL
SELECT 'workflow_executions', COUNT(*) FROM public.workflow_executions
UNION ALL
SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM public.activity_logs
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM public.subscription_plans
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM public.subscriptions
UNION ALL
SELECT 'payment_history', COUNT(*) FROM public.payment_history
UNION ALL
SELECT 'image_uploads', COUNT(*) FROM public.image_uploads
UNION ALL
SELECT 'system_settings', COUNT(*) FROM public.system_settings
UNION ALL
SELECT 'frontend_settings', COUNT(*) FROM public.frontend_settings
UNION ALL
SELECT 'google_calendar_integrations', COUNT(*) FROM public.google_calendar_integrations
UNION ALL
SELECT 'integration_settings', COUNT(*) FROM public.integration_settings
UNION ALL
SELECT 'user_smtp_settings', COUNT(*) FROM public.user_smtp_settings
ORDER BY table_name;

-- Commit transaction
COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ All tables cleaned successfully!';
  RAISE NOTICE '📊 Check the query results above - all counts should be 0';
  RAISE NOTICE '🚀 Next step: Run database-complete-data-export.sql';
END $$;

-- =====================================================
-- NEXT STEP: Run database-complete-data-export.sql
-- =====================================================