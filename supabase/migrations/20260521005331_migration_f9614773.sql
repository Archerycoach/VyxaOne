CREATE TABLE IF NOT EXISTS public.contact_property_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      intent TEXT,
      property_type TEXT,
      typologies TEXT[],
      min_price NUMERIC,
      max_price NUMERIC,
      locations TEXT[],
      urgency TEXT DEFAULT 'medium',
      is_active BOOLEAN DEFAULT true,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE public.contact_property_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "select_own" ON public.contact_property_requests;
    CREATE POLICY "select_own" ON public.contact_property_requests FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "insert_own" ON public.contact_property_requests;
    CREATE POLICY "insert_own" ON public.contact_property_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "update_own" ON public.contact_property_requests;
    CREATE POLICY "update_own" ON public.contact_property_requests FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "delete_own" ON public.contact_property_requests;
    CREATE POLICY "delete_own" ON public.contact_property_requests FOR DELETE USING (auth.uid() = user_id);