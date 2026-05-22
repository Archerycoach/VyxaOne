-- Create the main integrations table
CREATE TABLE IF NOT EXISTS public.notion_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT,
  workspace_name TEXT,
  bot_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id)
);

-- Enable RLS and setup policies
ALTER TABLE public.notion_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notion integration" ON public.notion_integrations;
CREATE POLICY "Users can view their own notion integration" ON public.notion_integrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own notion integration" ON public.notion_integrations;
CREATE POLICY "Users can insert their own notion integration" ON public.notion_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notion integration" ON public.notion_integrations;
CREATE POLICY "Users can update their own notion integration" ON public.notion_integrations FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own notion integration" ON public.notion_integrations;
CREATE POLICY "Users can delete their own notion integration" ON public.notion_integrations FOR DELETE USING (auth.uid() = user_id);

-- Create the database mappings table
CREATE TABLE IF NOT EXISTS public.notion_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'leads', 'properties', 'tasks'
  notion_database_id TEXT NOT NULL,
  notion_database_name TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'outbound',
  field_mappings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id, entity_type)
);

-- Enable RLS and setup policies
ALTER TABLE public.notion_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notion mappings" ON public.notion_mappings;
CREATE POLICY "Users can view their own notion mappings" ON public.notion_mappings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own notion mappings" ON public.notion_mappings;
CREATE POLICY "Users can insert their own notion mappings" ON public.notion_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notion mappings" ON public.notion_mappings;
CREATE POLICY "Users can update their own notion mappings" ON public.notion_mappings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own notion mappings" ON public.notion_mappings;
CREATE POLICY "Users can delete their own notion mappings" ON public.notion_mappings FOR DELETE USING (auth.uid() = user_id);