-- Add missing columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_type TEXT CHECK (lead_type IN ('buyer', 'seller', 'both')),
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Update type column constraint to match new lead_type
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_type_check;

-- Migrate existing data if needed (map old 'type' to 'lead_type')
UPDATE public.leads SET lead_type = type WHERE lead_type IS NULL AND type IS NOT NULL;

-- Create index for new columns
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON public.leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON public.leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON public.leads(last_contact_date);

-- Update RLS policies for leads to include created_by
DROP POLICY IF EXISTS "Agents can view their own leads" ON public.leads;
CREATE POLICY "Agents can view their own leads" ON public.leads
FOR SELECT
USING (assigned_to = auth.uid() OR created_by = auth.uid() OR user_id = auth.uid());