CREATE TABLE IF NOT EXISTS public.contact_alert_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name text NOT NULL,
  opportunity_type text NOT NULL DEFAULT 'both',
  preferred_cities text[] NOT NULL DEFAULT '{}'::text[],
  preferred_districts text[] NOT NULL DEFAULT '{}'::text[],
  property_types text[] NOT NULL DEFAULT '{}'::text[],
  typologies text[] NOT NULL DEFAULT '{}'::text[],
  min_price numeric(12,2),
  max_price numeric(12,2),
  min_bedrooms integer,
  urgency text NOT NULL DEFAULT 'medium',
  notification_channel text NOT NULL DEFAULT 'both',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_alert_requests_opportunity_type_check CHECK (opportunity_type IN ('property', 'development', 'both')),
  CONSTRAINT contact_alert_requests_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT contact_alert_requests_notification_channel_check CHECK (notification_channel IN ('ia', 'agenda', 'both')),
  CONSTRAINT contact_alert_requests_price_check CHECK (max_price IS NULL OR min_price IS NULL OR max_price >= min_price),
  CONSTRAINT contact_alert_requests_bedrooms_check CHECK (min_bedrooms IS NULL OR min_bedrooms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_contact_alert_requests_contact_id ON public.contact_alert_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_alert_requests_user_id ON public.contact_alert_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_alert_requests_active ON public.contact_alert_requests(is_active, updated_at DESC);

ALTER TABLE public.contact_alert_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_alert_requests' AND policyname = 'contact_alert_requests_select_own'
  ) THEN
    CREATE POLICY contact_alert_requests_select_own
      ON public.contact_alert_requests
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_alert_requests' AND policyname = 'contact_alert_requests_insert_own'
  ) THEN
    CREATE POLICY contact_alert_requests_insert_own
      ON public.contact_alert_requests
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_alert_requests' AND policyname = 'contact_alert_requests_update_own'
  ) THEN
    CREATE POLICY contact_alert_requests_update_own
      ON public.contact_alert_requests
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_alert_requests' AND policyname = 'contact_alert_requests_delete_own'
  ) THEN
    CREATE POLICY contact_alert_requests_delete_own
      ON public.contact_alert_requests
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contact_opportunity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.contact_alert_requests(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  opportunity_type text NOT NULL,
  match_score integer NOT NULL,
  match_reasons text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'new',
  notification_channel text NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_opportunity_matches_type_check CHECK (opportunity_type IN ('property', 'development')),
  CONSTRAINT contact_opportunity_matches_status_check CHECK (status IN ('new', 'task_created', 'contacted', 'dismissed')),
  CONSTRAINT contact_opportunity_matches_channel_check CHECK (notification_channel IN ('ia', 'agenda', 'both')),
  CONSTRAINT contact_opportunity_matches_score_check CHECK (match_score BETWEEN 0 AND 100),
  CONSTRAINT contact_opportunity_matches_single_target_check CHECK (
    (property_id IS NOT NULL AND development_id IS NULL) OR
    (property_id IS NULL AND development_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_contact_opportunity_matches_contact_id ON public.contact_opportunity_matches(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_opportunity_matches_request_id ON public.contact_opportunity_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_contact_opportunity_matches_status ON public.contact_opportunity_matches(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_opportunity_matches_unique_property
  ON public.contact_opportunity_matches(request_id, property_id)
  WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_opportunity_matches_unique_development
  ON public.contact_opportunity_matches(request_id, development_id)
  WHERE development_id IS NOT NULL;

ALTER TABLE public.contact_opportunity_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_opportunity_matches' AND policyname = 'contact_opportunity_matches_select_own'
  ) THEN
    CREATE POLICY contact_opportunity_matches_select_own
      ON public.contact_opportunity_matches
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_opportunity_matches' AND policyname = 'contact_opportunity_matches_insert_own'
  ) THEN
    CREATE POLICY contact_opportunity_matches_insert_own
      ON public.contact_opportunity_matches
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_opportunity_matches' AND policyname = 'contact_opportunity_matches_update_own'
  ) THEN
    CREATE POLICY contact_opportunity_matches_update_own
      ON public.contact_opportunity_matches
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_opportunity_matches' AND policyname = 'contact_opportunity_matches_delete_own'
  ) THEN
    CREATE POLICY contact_opportunity_matches_delete_own
      ON public.contact_opportunity_matches
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;