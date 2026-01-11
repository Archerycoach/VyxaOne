-- Add team_lead_id column to profiles table to track agent-team lead relationships
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_team_lead_id ON public.profiles(team_lead_id);

-- Create RLS policy to allow team leads to see their assigned agents
CREATE POLICY "Team leads can view their agents" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR 
  team_lead_id = auth.uid()
  OR
  role = 'admin'
);