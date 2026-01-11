-- =====================================================
-- VYXA ONE CRM - DATABASE SCHEMA EXPORT
-- =====================================================
-- Generated: 2026-01-11
-- Description: Complete database schema for Vyxa One CRM
-- 
-- INSTRUCTIONS:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Execute the query
-- 5. Verify all tables and policies were created
--
-- NOTE: This file contains ONLY the schema structure.
-- To migrate data, you need to export data separately.
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- TABLE: profiles
-- Description: User profiles with roles and settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    phone text,
    role text DEFAULT 'agent'::text,
    is_active boolean DEFAULT true,
    team_lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone,
    reply_email text,
    email_daily_tasks boolean DEFAULT false,
    email_daily_events boolean DEFAULT false,
    email_new_lead_assigned boolean DEFAULT false,
    subscription_status text,
    subscription_plan text,
    subscription_end_date timestamp with time zone,
    trial_ends_at timestamp with time zone,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'team_lead'::text, 'agent'::text])),
    CONSTRAINT profiles_subscription_status_check CHECK (subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'cancelled'::text, 'expired'::text])),
    CONSTRAINT profiles_email_format_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
    CONSTRAINT profiles_phone_format_check CHECK (phone ~* '^\+?[0-9]{9,15}$'::text)
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email_notifications ON public.profiles USING btree (email_daily_tasks, email_daily_events, email_new_lead_assigned);
CREATE INDEX IF NOT EXISTS idx_profiles_reply_email ON public.profiles USING btree (reply_email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_team_lead ON public.profiles USING btree (team_lead_id);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can delete any profile" ON public.profiles
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: contacts
-- Description: Contact management
-- =====================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text,
    company text,
    position text,
    notes text,
    tags text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    birth_date date,
    auto_message_config jsonb DEFAULT '{}'::jsonb,
    lead_source_id uuid,
    CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_birth_date ON public.contacts USING btree (birth_date);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts USING btree (email);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts USING btree (user_id);

-- RLS Policies for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create contacts" ON public.contacts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "agents_view_own_contacts" ON public.contacts
    FOR SELECT USING (
        user_id = auth.uid() AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'agent'::text)
    );

CREATE POLICY "team_leads_view_team_contacts" ON public.contacts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'team_lead'::text) AND
        (user_id = auth.uid() OR user_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid()))
    );

CREATE POLICY "admins_view_all_contacts" ON public.contacts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Users can update their own contacts" ON public.contacts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "team_leads_update_team_contacts" ON public.contacts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'team_lead'::text 
            AND (
                contacts.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.profiles agent_profile 
                    WHERE agent_profile.id = contacts.user_id AND agent_profile.team_lead_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "admins_update_all_contacts" ON public.contacts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Users can delete their own contacts" ON public.contacts
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: leads
-- Description: Lead management with scoring and workflow
-- =====================================================

CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text,
    phone text,
    lead_type text DEFAULT 'buyer'::text,
    status text DEFAULT 'new'::text,
    source text DEFAULT 'website'::text,
    score integer DEFAULT 0,
    temperature text DEFAULT 'cold'::text,
    budget numeric(12,2),
    budget_min numeric(12,2),
    budget_max numeric(12,2),
    property_type text,
    location_preference text,
    bedrooms integer,
    bathrooms integer,
    min_area numeric(10,2),
    max_area numeric(10,2),
    notes text,
    tags text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    last_contact_date timestamp with time zone,
    next_follow_up timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    needs_financing boolean DEFAULT false,
    desired_price numeric(12,2),
    property_area numeric(12,2),
    archived_at timestamp with time zone,
    probability integer DEFAULT 0,
    lead_score integer DEFAULT 0,
    estimated_value numeric(12,2) DEFAULT 0,
    is_development boolean DEFAULT false,
    development_name text,
    CONSTRAINT leads_pkey PRIMARY KEY (id),
    CONSTRAINT leads_lead_type_check CHECK (lead_type = ANY (ARRAY['buyer'::text, 'seller'::text, 'both'::text])),
    CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'proposal'::text, 'negotiation'::text, 'won'::text, 'lost'::text, 'archived'::text])),
    CONSTRAINT leads_source_check CHECK (source = ANY (ARRAY['website'::text, 'facebook'::text, 'instagram'::text, 'referral'::text, 'phone'::text, 'email'::text, 'walk_in'::text, 'other'::text])),
    CONSTRAINT leads_temperature_check CHECK (temperature = ANY (ARRAY['hot'::text, 'warm'::text, 'cold'::text])),
    CONSTRAINT leads_score_check CHECK (score >= 0 AND score <= 100),
    CONSTRAINT leads_probability_check CHECK (probability >= 0 AND probability <= 100),
    CONSTRAINT leads_lead_score_check CHECK (lead_score >= 0 AND lead_score <= 100),
    CONSTRAINT leads_email_format_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
    CONSTRAINT leads_phone_format_check CHECK (phone ~* '^\+?[0-9]{9,15}$'::text)
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_archived ON public.leads USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON public.leads USING btree (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON public.leads USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_probability ON public.leads USING btree (probability);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads USING btree (score);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned_to ON public.leads USING btree (status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON public.leads USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_type ON public.leads USING btree (lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_status_created ON public.leads USING btree (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_value ON public.leads USING btree (estimated_value);

-- RLS Policies for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_create_leads" ON public.leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agents_view_own_created_leads" ON public.leads
    FOR SELECT USING (
        user_id = auth.uid() AND 
        (SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'agent'::text
    );

CREATE POLICY "agents_view_assigned_leads" ON public.leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'agent'::text AND leads.assigned_to = auth.uid()
        )
    );

CREATE POLICY "team_leads_view_team_leads" ON public.leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'team_lead'::text 
            AND (
                leads.user_id = auth.uid() OR 
                leads.assigned_to = auth.uid() OR 
                leads.assigned_to IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid())
            )
        )
    );

CREATE POLICY "admins_view_all_leads" ON public.leads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "agents_update_own_created_leads" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'agent'::text AND leads.user_id = auth.uid()
        )
    );

CREATE POLICY "agents_update_assigned_leads" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'agent'::text AND leads.assigned_to = auth.uid()
        )
    );

CREATE POLICY "team_leads_update_team_leads" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'team_lead'::text 
            AND (
                leads.user_id = auth.uid() OR 
                leads.assigned_to = auth.uid() OR 
                leads.assigned_to IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid())
            )
        )
    );

CREATE POLICY "admins_update_all_leads" ON public.leads
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "admins_full_access" ON public.leads
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "creators_delete_leads" ON public.leads
    FOR DELETE USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: lead_notes
-- Description: Notes associated with leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT lead_notes_pkey PRIMARY KEY (id)
);

-- Indexes for lead_notes
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON public.lead_notes USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes USING btree (lead_id);

-- RLS Policies for lead_notes
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create lead notes" ON public.lead_notes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view lead notes" ON public.lead_notes
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own lead notes" ON public.lead_notes
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own lead notes" ON public.lead_notes
    FOR DELETE USING (auth.uid() = created_by);

-- =====================================================
-- TABLE: properties
-- Description: Property listings management
-- =====================================================

CREATE TABLE IF NOT EXISTS public.properties (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    property_type text NOT NULL,
    status text DEFAULT 'available'::text,
    address text,
    city text,
    district text,
    postal_code text,
    country text DEFAULT 'Portugal'::text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    bedrooms integer,
    bathrooms integer,
    area numeric(10,2),
    land_area numeric(10,2),
    year_built integer,
    floor integer,
    total_floors integer,
    price numeric(12,2),
    price_per_sqm numeric(10,2),
    rental_price numeric(10,2),
    condominium_fee numeric(10,2),
    features text[],
    amenities text[],
    images text[],
    virtual_tour_url text,
    video_url text,
    reference_code text UNIQUE,
    is_featured boolean DEFAULT false,
    views_count integer DEFAULT 0,
    notes text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    listed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    main_image_url text,
    typology text,
    energy_rating text,
    CONSTRAINT properties_pkey PRIMARY KEY (id),
    CONSTRAINT properties_property_type_check CHECK (property_type = ANY (ARRAY['apartment'::text, 'house'::text, 'land'::text, 'commercial'::text, 'office'::text, 'warehouse'::text, 'other'::text])),
    CONSTRAINT properties_status_check CHECK (status = ANY (ARRAY['available'::text, 'reserved'::text, 'sold'::text, 'rented'::text])),
    CONSTRAINT properties_positive_price_check CHECK (price > 0::numeric OR price IS NULL),
    CONSTRAINT properties_positive_rental_check CHECK (rental_price > 0::numeric OR rental_price IS NULL)
);

-- Indexes for properties
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties USING btree (city);
CREATE INDEX IF NOT EXISTS idx_properties_city_type_status ON public.properties USING btree (city, property_type, status);
CREATE INDEX IF NOT EXISTS idx_properties_district ON public.properties USING btree (district);
CREATE INDEX IF NOT EXISTS idx_properties_postal_code ON public.properties USING btree (postal_code);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties USING btree (price);
CREATE INDEX IF NOT EXISTS idx_properties_reference ON public.properties USING btree (reference_code);
CREATE INDEX IF NOT EXISTS idx_properties_rental_price ON public.properties USING btree (rental_price);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties USING btree (status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties USING btree (property_type);
CREATE INDEX IF NOT EXISTS idx_properties_type_city_status ON public.properties USING btree (property_type, city, status);
CREATE INDEX IF NOT EXISTS idx_properties_type_status_price ON public.properties USING btree (property_type, status, price);
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties USING btree (user_id);

-- RLS Policies for properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create properties" ON public.properties
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "agents_view_own_properties" ON public.properties
    FOR SELECT USING (
        user_id = auth.uid() AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'agent'::text)
    );

CREATE POLICY "team_leads_view_team_properties" ON public.properties
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'team_lead'::text) AND
        (user_id = auth.uid() OR user_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid()))
    );

CREATE POLICY "admins_view_all_properties" ON public.properties
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Users can update their properties" ON public.properties
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "team_leads_update_team_properties" ON public.properties
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'team_lead'::text 
            AND (
                properties.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.profiles agent_profile 
                    WHERE agent_profile.id = properties.user_id AND agent_profile.team_lead_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "admins_update_all_properties" ON public.properties
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Users can delete their properties" ON public.properties
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: property_matches
-- Description: Match leads with properties
-- =====================================================

CREATE TABLE IF NOT EXISTS public.property_matches (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    match_score integer,
    match_reasons text[],
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT property_matches_pkey PRIMARY KEY (id),
    CONSTRAINT property_matches_lead_id_property_id_key UNIQUE (lead_id, property_id),
    CONSTRAINT property_matches_status_check CHECK (status = ANY (ARRAY['pending'::text, 'viewed'::text, 'interested'::text, 'rejected'::text])),
    CONSTRAINT property_matches_match_score_check CHECK (match_score >= 0 AND match_score <= 100)
);

-- Indexes for property_matches
CREATE INDEX IF NOT EXISTS idx_property_matches_lead_id ON public.property_matches USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_lead_score ON public.property_matches USING btree (lead_id, match_score);
CREATE INDEX IF NOT EXISTS idx_property_matches_property_id ON public.property_matches USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_score_desc ON public.property_matches USING btree (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_property_matches_status ON public.property_matches USING btree (status);

-- RLS Policies for property_matches
ALTER TABLE public.property_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create property matches" ON public.property_matches
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.leads WHERE leads.id = property_matches.lead_id AND leads.user_id = auth.uid())
    );

CREATE POLICY "Users can view matches for their leads" ON public.property_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE leads.id = property_matches.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can update their property matches" ON public.property_matches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE leads.id = property_matches.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can delete their property matches" ON public.property_matches
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.leads WHERE leads.id = property_matches.lead_id AND leads.user_id = auth.uid())
    );

-- =====================================================
-- TABLE: calendar_events
-- Description: Calendar events with Google Calendar sync
-- =====================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    location text,
    event_type text DEFAULT 'meeting'::text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    all_day boolean DEFAULT false,
    attendees text[],
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    google_calendar_id text,
    google_event_id text,
    is_synced boolean DEFAULT false,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
    CONSTRAINT calendar_events_google_event_id_user_id_key UNIQUE (google_event_id, user_id),
    CONSTRAINT calendar_events_event_type_check CHECK (event_type = ANY (ARRAY['meeting'::text, 'viewing'::text, 'call'::text, 'other'::text])),
    CONSTRAINT calendar_events_time_order_check CHECK (end_time > start_time)
);

-- Indexes for calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_contact_id ON public.calendar_events USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact ON public.calendar_events USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON public.calendar_events USING btree (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_google_sync ON public.calendar_events USING btree (google_event_id, is_synced);
CREATE INDEX IF NOT EXISTS idx_calendar_lead_id ON public.calendar_events USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_start_time ON public.calendar_events USING btree (start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_user_id ON public.calendar_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_user_start_end ON public.calendar_events USING btree (user_id, start_time, end_time);

-- RLS Policies for calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create calendar events" ON public.calendar_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their calendar events" ON public.calendar_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Team leads can view their agents events" ON public.calendar_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text) OR
        user_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid())
    );

CREATE POLICY "Users can update their calendar events" ON public.calendar_events
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their calendar events" ON public.calendar_events
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: tasks
-- Description: Task management with Google Calendar sync
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    priority text DEFAULT 'medium'::text,
    related_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    related_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    related_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    tags text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notes text,
    google_event_id text,
    is_synced boolean DEFAULT false,
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
    CONSTRAINT tasks_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due ON public.tasks USING btree (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_google_sync ON public.tasks USING btree (google_event_id, is_synced);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_user_date ON public.tasks USING btree (status, user_id, due_date) WHERE status = 'pending'::text;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks USING btree (user_id);

-- RLS Policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create tasks" ON public.tasks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their tasks" ON public.tasks
    FOR SELECT USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Team leads can view their agents tasks" ON public.tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text) OR
        assigned_to IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid())
    );

CREATE POLICY "Users can update their tasks" ON public.tasks
    FOR UPDATE USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can delete their tasks" ON public.tasks
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: interactions
-- Description: Track all interactions with leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.interactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interaction_type text NOT NULL,
    subject text,
    content text,
    outcome text,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    interaction_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT interactions_pkey PRIMARY KEY (id),
    CONSTRAINT interactions_interaction_type_check CHECK (interaction_type = ANY (ARRAY['call'::text, 'email'::text, 'meeting'::text, 'viewing'::text, 'note'::text, 'whatsapp'::text, 'sms'::text, 'other'::text]))
);

-- Indexes for interactions
CREATE INDEX IF NOT EXISTS idx_interactions_date ON public.interactions USING btree (interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_date ON public.interactions USING btree (lead_id, interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_date_desc ON public.interactions USING btree (lead_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON public.interactions USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON public.interactions USING btree (user_id);

-- RLS Policies for interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create interactions" ON public.interactions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their interactions" ON public.interactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Team leads can view their agents interactions" ON public.interactions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text) OR
        user_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.team_lead_id = auth.uid())
    );

CREATE POLICY "Users can update their interactions" ON public.interactions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their interactions" ON public.interactions
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: documents
-- Description: Document management
-- =====================================================

CREATE TABLE IF NOT EXISTS public.documents (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    file_size integer,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    tags text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT documents_pkey PRIMARY KEY (id)
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON public.documents USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_property ON public.documents USING btree (lead_id, property_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents USING btree (user_id);

-- RLS Policies for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create documents" ON public.documents
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their documents" ON public.documents
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can delete their documents" ON public.documents
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: templates
-- Description: Email/SMS/WhatsApp templates
-- =====================================================

CREATE TABLE IF NOT EXISTS public.templates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_type text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT templates_pkey PRIMARY KEY (id),
    CONSTRAINT templates_template_type_check CHECK (template_type = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text]))
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_templates_type ON public.templates USING btree (template_type);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates USING btree (user_id);

-- RLS Policies for templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create templates" ON public.templates
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their templates" ON public.templates
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their templates" ON public.templates
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their templates" ON public.templates
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: lead_workflow_rules
-- Description: Automated workflow rules for leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_workflow_rules (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    trigger_status text NOT NULL,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb,
    delay_days integer DEFAULT 0,
    delay_hours integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lead_workflow_rules_pkey PRIMARY KEY (id),
    CONSTRAINT lead_workflow_rules_action_type_check CHECK (action_type = ANY (ARRAY['send_email'::text, 'send_sms'::text, 'create_task'::text, 'update_status'::text, 'send_whatsapp'::text]))
);

-- RLS Policies for lead_workflow_rules
ALTER TABLE public.lead_workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create workflow rules" ON public.lead_workflow_rules
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their workflow rules" ON public.lead_workflow_rules
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their workflow rules" ON public.lead_workflow_rules
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their workflow rules" ON public.lead_workflow_rules
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: workflow_executions
-- Description: Track workflow rule executions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    workflow_id uuid NOT NULL REFERENCES public.lead_workflow_rules(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending'::text,
    executed_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_executions_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_executions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))
);

-- Indexes for workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_lead_id ON public.workflow_executions USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON public.workflow_executions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions USING btree (workflow_id);

-- RLS Policies for workflow_executions
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own workflow executions" ON public.workflow_executions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own workflow executions" ON public.workflow_executions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow executions" ON public.workflow_executions
    FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: notifications
-- Description: In-app notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text,
    notification_type text DEFAULT 'info'::text,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    related_entity_type text,
    related_entity_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    data jsonb,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_notification_type_check CHECK (notification_type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text]))
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user_created ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications USING btree (user_id, is_read, created_at);

-- RLS Policies for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications" ON public.notifications
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TABLE: activity_logs
-- Description: System activity logging
-- =====================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

-- Indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);

-- RLS Policies for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can create activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their activity logs" ON public.activity_logs
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- TABLE: subscription_plans
-- Description: Available subscription plans
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'EUR'::text,
    billing_interval text DEFAULT 'monthly'::text,
    features jsonb DEFAULT '{}'::jsonb,
    limits jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    stripe_price_id text,
    stripe_product_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_plans_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plans_billing_interval_check CHECK (billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))
);

-- RLS Policies for subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans" ON public.subscription_plans
    FOR SELECT USING (true);

CREATE POLICY "Admins can create subscription plans" ON public.subscription_plans
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can update subscription plans" ON public.subscription_plans
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can delete subscription plans" ON public.subscription_plans
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: subscriptions
-- Description: User subscriptions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    status text DEFAULT 'active'::text,
    stripe_subscription_id text,
    stripe_customer_id text,
    eupago_reference text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    trial_end timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'unpaid'::text, 'trialing'::text]))
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_user ON public.subscriptions USING btree (user_id, status) WHERE status = 'active'::text;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);

-- RLS Policies for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their subscriptions" ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own subscriptions" ON public.subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their subscriptions" ON public.subscriptions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can create subscriptions for any user" ON public.subscriptions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: payment_history
-- Description: Payment transaction history
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payment_history (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'EUR'::text,
    status text DEFAULT 'pending'::text,
    payment_method text,
    payment_reference text,
    stripe_payment_intent_id text,
    eupago_transaction_id text,
    payment_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT payment_history_pkey PRIMARY KEY (id),
    CONSTRAINT payment_history_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
    CONSTRAINT payment_history_payment_method_check CHECK (payment_method = ANY (ARRAY['stripe'::text, 'multibanco'::text, 'mbway'::text, 'paypal'::text]))
);

-- Indexes for payment_history
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_date ON public.payment_history USING btree (subscription_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON public.payment_history USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history USING btree (user_id);

-- RLS Policies for payment_history
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can create payment records" ON public.payment_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their payment history" ON public.payment_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payment history" ON public.payment_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: image_uploads
-- Description: Image upload tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.image_uploads (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT image_uploads_pkey PRIMARY KEY (id)
);

-- Indexes for image_uploads
CREATE INDEX IF NOT EXISTS idx_image_uploads_entity ON public.image_uploads USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_image_uploads_user_id ON public.image_uploads USING btree (user_id);

-- RLS Policies for image_uploads
ALTER TABLE public.image_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own uploads" ON public.image_uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own uploads" ON public.image_uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all uploads" ON public.image_uploads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Users can delete their own uploads" ON public.image_uploads
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: system_settings
-- Description: Global system settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);

-- RLS Policies for system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_public_read" ON public.system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can create system settings" ON public.system_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can update system settings" ON public.system_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can delete system settings" ON public.system_settings
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: frontend_settings
-- Description: Frontend customization settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.frontend_settings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    category text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT frontend_settings_pkey PRIMARY KEY (id)
);

-- RLS Policies for frontend_settings
ALTER TABLE public.frontend_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public frontend settings" ON public.frontend_settings
    FOR SELECT USING (category = 'public'::text);

CREATE POLICY "Admins can view frontend settings" ON public.frontend_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can insert frontend settings" ON public.frontend_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can update frontend settings" ON public.frontend_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: google_calendar_integrations
-- Description: Google Calendar integration settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    google_email text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone NOT NULL,
    calendar_id text DEFAULT 'primary'::text,
    sync_events boolean DEFAULT true,
    sync_tasks boolean DEFAULT true,
    sync_notes boolean DEFAULT false,
    sync_direction text DEFAULT 'both'::text,
    auto_sync boolean DEFAULT true,
    last_sync_at timestamp with time zone,
    webhook_channel_id text,
    webhook_expiration timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT google_calendar_integrations_pkey PRIMARY KEY (id),
    CONSTRAINT google_calendar_integrations_sync_direction_check CHECK (sync_direction = ANY (ARRAY['both'::text, 'to_google'::text, 'from_google'::text]))
);

-- RLS Policies for google_calendar_integrations
ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Google Calendar integration" ON public.google_calendar_integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Calendar integration" ON public.google_calendar_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Calendar integration" ON public.google_calendar_integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Calendar integration" ON public.google_calendar_integrations
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: integration_settings
-- Description: Third-party integration settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.integration_settings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    service_name text NOT NULL UNIQUE,
    client_id text,
    client_secret text,
    redirect_uri text,
    scopes text[],
    enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT integration_settings_pkey PRIMARY KEY (id)
);

-- RLS Policies for integration_settings
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration settings" ON public.integration_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can insert integration settings" ON public.integration_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

CREATE POLICY "Admins can update integration settings" ON public.integration_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text)
    );

-- =====================================================
-- TABLE: user_smtp_settings
-- Description: User-specific SMTP configuration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_smtp_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    smtp_host text NOT NULL,
    smtp_port integer NOT NULL DEFAULT 587,
    smtp_secure boolean NOT NULL DEFAULT false,
    smtp_username text NOT NULL,
    smtp_password text NOT NULL,
    from_email text NOT NULL,
    from_name text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_smtp_settings_pkey PRIMARY KEY (id)
);

-- Indexes for user_smtp_settings
CREATE INDEX IF NOT EXISTS idx_user_smtp_settings_user_id ON public.user_smtp_settings USING btree (user_id);

-- RLS Policies for user_smtp_settings
ALTER TABLE public.user_smtp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SMTP settings" ON public.user_smtp_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SMTP settings" ON public.user_smtp_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMTP settings" ON public.user_smtp_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMTP settings" ON public.user_smtp_settings
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS (Applied after all tables)
-- =====================================================

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_lead_source_id_fkey 
    FOREIGN KEY (lead_source_id) REFERENCES public.leads(id) ON DELETE SET NULL;

-- =====================================================
-- FINAL NOTES
-- =====================================================
-- 
-- ✅ All 24 tables created with complete structure
-- ✅ All RLS policies applied for security
-- ✅ All indexes created for performance
-- ✅ All foreign keys and constraints in place
-- ✅ All check constraints for data validation
--
-- NEXT STEPS:
-- 1. Execute this file in your new Supabase project
-- 2. Verify all tables were created: Check Database > Tables
-- 3. Verify RLS is enabled: Check Table > Policies
-- 4. Export data from old database
-- 5. Import data into new database
-- 6. Update .env.local with new Supabase credentials
-- 7. Test application functionality
--
-- =====================================================