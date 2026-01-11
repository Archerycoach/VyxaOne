-- Create system_settings table for app configuration (logo, company name, etc.)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings
CREATE POLICY "Anyone can view system settings" ON public.system_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update settings" ON public.system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Insert default settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('app_branding', '{"companyName": "Imogest", "logo": null}'::jsonb, 'Company name and logo configuration'),
  ('enabled_modules', '{"compare": false, "market": false, "documents": false}'::jsonb, 'Enabled optional modules')
ON CONFLICT (key) DO NOTHING;