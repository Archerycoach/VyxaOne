ALTER TABLE public.gpt_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own gpt keys" ON public.gpt_api_keys;

CREATE POLICY "Users can manage their own gpt keys"
ON public.gpt_api_keys
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);