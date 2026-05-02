CREATE TABLE IF NOT EXISTS public.gpt_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.gpt_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own gpt api keys" ON public.gpt_api_keys 
FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gpt_api_keys_user_id ON public.gpt_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_gpt_api_keys_api_key ON public.gpt_api_keys(api_key);