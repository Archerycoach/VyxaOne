CREATE TABLE IF NOT EXISTS public.external_property_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL, -- e.g., 'casayes', 'idealista'
  is_enabled BOOLEAN DEFAULT false,
  api_key TEXT,
  api_secret TEXT,
  base_url TEXT,
  custom_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider_name)
);

ALTER TABLE public.external_property_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portal settings" ON public.external_property_portals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portal settings" ON public.external_property_portals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portal settings" ON public.external_property_portals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portal settings" ON public.external_property_portals
  FOR DELETE USING (auth.uid() = user_id);