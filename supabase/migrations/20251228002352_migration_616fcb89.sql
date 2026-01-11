-- Create pipeline_stages table for customizable sales pipeline
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- hex color for visual distinction
  position INTEGER NOT NULL, -- order in the pipeline
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(position)
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Everyone can view stages
CREATE POLICY "Everyone can view pipeline stages" ON public.pipeline_stages
FOR SELECT
USING (is_active = true);

-- Only admins can manage stages
CREATE POLICY "Admins can manage pipeline stages" ON public.pipeline_stages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Insert default pipeline stages
INSERT INTO public.pipeline_stages (name, color, position, is_default) VALUES
('Novo', '#6b7280', 1, true),
('Contactado', '#3b82f6', 2, true),
('Qualificado', '#8b5cf6', 3, true),
('Proposta Enviada', '#f59e0b', 4, true),
('Negociação', '#ef4444', 5, true),
('Ganho', '#10b981', 6, true),
('Perdido', '#6b7280', 7, true)
ON CONFLICT (position) DO NOTHING;