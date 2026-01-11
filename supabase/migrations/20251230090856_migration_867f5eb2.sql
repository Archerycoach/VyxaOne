-- =====================================================
-- IMOGEST CRM - COMPLETE DATABASE SCHEMA
-- Version: 2.0 - Fresh Start
-- Environment: Production & Testing
-- =====================================================

-- =====================================================
-- STEP 1: ENABLE EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- =====================================================
-- STEP 2: CREATE CORE TABLES
-- =====================================================

-- Update Profiles Table (extend existing)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add role constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'team_lead', 'agent'));
  END IF;
END $$;

-- Contacts Table (standalone contact management)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads Table (potential clients)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Lead basic info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Lead classification
  lead_type TEXT DEFAULT 'buyer',
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'website',
  
  -- Lead scoring
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  temperature TEXT DEFAULT 'cold',
  
  -- Financial info
  budget DECIMAL(12, 2),
  budget_min DECIMAL(12, 2),
  budget_max DECIMAL(12, 2),
  
  -- Requirements
  property_type TEXT,
  location_preference TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  min_area DECIMAL(10, 2),
  max_area DECIMAL(10, 2),
  
  -- Additional info
  notes TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to leads
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_lead_type_check') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_lead_type_check CHECK (lead_type IN ('buyer', 'seller', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_check') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('website', 'referral', 'social_media', 'cold_call', 'event', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_temperature_check') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_temperature_check CHECK (temperature IN ('cold', 'warm', 'hot'));
  END IF;
END $$;

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Property basic info
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  
  -- Location
  address TEXT,
  city TEXT,
  district TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Portugal',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Property details
  bedrooms INTEGER,
  bathrooms INTEGER,
  area DECIMAL(10, 2),
  land_area DECIMAL(10, 2),
  year_built INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  
  -- Financial
  price DECIMAL(12, 2),
  price_per_sqm DECIMAL(10, 2),
  rental_price DECIMAL(10, 2),
  condominium_fee DECIMAL(10, 2),
  
  -- Features
  features TEXT[],
  amenities TEXT[],
  
  -- Media
  images TEXT[],
  virtual_tour_url TEXT,
  video_url TEXT,
  
  -- SEO & Marketing
  reference_code TEXT UNIQUE,
  is_featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  
  -- Additional
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  listed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to properties
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_property_type_check') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_property_type_check CHECK (property_type IN ('apartment', 'house', 'land', 'commercial', 'office', 'warehouse', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_status_check') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_status_check CHECK (status IN ('available', 'reserved', 'sold', 'rented', 'off_market'));
  END IF;
END $$;

-- Property Matches (AI-powered lead-property matching)
CREATE TABLE IF NOT EXISTS property_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[],
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, property_id)
);

-- Add constraint to property_matches
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_matches_status_check') THEN
    ALTER TABLE property_matches ADD CONSTRAINT property_matches_status_check CHECK (status IN ('pending', 'viewed', 'interested', 'rejected'));
  END IF;
END $$;

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Task info
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  
  -- Relations
  related_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  related_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Timing
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to tasks
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Event info
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_type TEXT DEFAULT 'meeting',
  
  -- Timing
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  
  -- Attendees
  attendees TEXT[],
  
  -- Relations
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Google Calendar sync
  google_calendar_id TEXT,
  google_event_id TEXT,
  is_synced BOOLEAN DEFAULT false,
  
  -- Additional
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to calendar_events
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_event_type_check') THEN
    ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check CHECK (event_type IN ('meeting', 'viewing', 'call', 'follow_up', 'other'));
  END IF;
END $$;

-- Interactions Table (communication history)
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Interaction info
  interaction_type TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  outcome TEXT,
  
  -- Relations
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Timing
  interaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to interactions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interactions_interaction_type_check') THEN
    ALTER TABLE interactions ADD CONSTRAINT interactions_interaction_type_check CHECK (interaction_type IN ('call', 'email', 'meeting', 'whatsapp', 'sms', 'note', 'other'));
  END IF;
END $$;

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Document info
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  
  -- Relations
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates Table (email/whatsapp templates)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Template info
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  
  -- Configuration
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to templates
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_template_type_check') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_template_type_check CHECK (template_type IN ('email', 'whatsapp', 'sms'));
  END IF;
END $$;

-- Workflow Rules Table (automation)
CREATE TABLE IF NOT EXISTS lead_workflow_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Rule info
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger
  trigger_status TEXT NOT NULL,
  
  -- Action
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  
  -- Timing
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to lead_workflow_rules
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_workflow_rules_action_type_check') THEN
    ALTER TABLE lead_workflow_rules ADD CONSTRAINT lead_workflow_rules_action_type_check CHECK (action_type IN ('send_email', 'create_task', 'create_calendar_event', 'update_score'));
  END IF;
END $$;

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification info
  title TEXT NOT NULL,
  message TEXT,
  notification_type TEXT DEFAULT 'info',
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Relations
  related_entity_type TEXT,
  related_entity_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to notifications
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_notification_type_check') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN ('info', 'success', 'warning', 'error'));
  END IF;
END $$;

-- Activity Logs Table (audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Activity info
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions Table (SaaS billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID,
  
  -- Subscription info
  status TEXT DEFAULT 'active',
  
  -- Payment provider IDs
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  eupago_reference TEXT,
  
  -- Dates
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to subscriptions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'unpaid'));
  END IF;
END $$;

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Plan info
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  billing_interval TEXT DEFAULT 'monthly',
  
  -- Features
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stripe
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to subscription_plans
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_billing_interval_check') THEN
    ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_billing_interval_check CHECK (billing_interval IN ('monthly', 'yearly'));
  END IF;
END $$;

-- Payment History Table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Payment info
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending',
  
  -- Payment method
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Provider IDs
  stripe_payment_intent_id TEXT,
  eupago_transaction_id TEXT,
  
  -- Dates
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints to payment_history
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_status_check') THEN
    ALTER TABLE payment_history ADD CONSTRAINT payment_history_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_payment_method_check') THEN
    ALTER TABLE payment_history ADD CONSTRAINT payment_history_payment_method_check CHECK (payment_method IN ('stripe', 'mbway', 'multibanco'));
  END IF;
END $$;

-- System Settings Table (admin configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);