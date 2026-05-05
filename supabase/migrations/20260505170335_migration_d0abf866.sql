CREATE TABLE IF NOT EXISTS public.developments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  address text,
  city text,
  district text,
  postal_code text,
  developer_name text,
  price_from numeric(12,2),
  price_to numeric(12,2),
  typologies text[],
  total_units integer,
  available_units integer,
  delivery_date date,
  published_at timestamp with time zone,
  highlights text[],
  images text[],
  main_image_url text,
  reference_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT developments_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'under_construction'::text, 'completed'::text, 'sold_out'::text])),
  CONSTRAINT developments_positive_price_from_check CHECK (price_from IS NULL OR price_from >= 0),
  CONSTRAINT developments_positive_price_to_check CHECK (price_to IS NULL OR price_to >= 0),
  CONSTRAINT developments_positive_units_check CHECK ((total_units IS NULL OR total_units >= 0) AND (available_units IS NULL OR available_units >= 0)),
  CONSTRAINT developments_units_consistency_check CHECK (available_units IS NULL OR total_units IS NULL OR available_units <= total_units),
  CONSTRAINT developments_reference_code_key UNIQUE (reference_code)
);

CREATE INDEX IF NOT EXISTS idx_developments_user_id ON public.developments(user_id);
CREATE INDEX IF NOT EXISTS idx_developments_status ON public.developments(status);
CREATE INDEX IF NOT EXISTS idx_developments_city ON public.developments(city);
CREATE INDEX IF NOT EXISTS idx_developments_published_at ON public.developments(published_at DESC);

ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'developments' AND policyname = 'developments_select_own'
  ) THEN
    CREATE POLICY "developments_select_own"
      ON public.developments
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'developments' AND policyname = 'developments_insert_own'
  ) THEN
    CREATE POLICY "developments_insert_own"
      ON public.developments
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'developments' AND policyname = 'developments_update_own'
  ) THEN
    CREATE POLICY "developments_update_own"
      ON public.developments
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'developments' AND policyname = 'developments_delete_own'
  ) THEN
    CREATE POLICY "developments_delete_own"
      ON public.developments
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;