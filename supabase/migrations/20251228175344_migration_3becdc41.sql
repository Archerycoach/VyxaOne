-- Create WhatsApp automations table
CREATE TABLE IF NOT EXISTS whatsapp_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL CHECK (automation_type IN ('birthday', 'celebration', 'followup', 'new_property', 'reminder')),
  enabled BOOLEAN DEFAULT FALSE,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  schedule_time TEXT DEFAULT '09:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, automation_type)
);

-- Create WhatsApp logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whatsapp_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_automations
CREATE POLICY "Users can view their own automations" ON whatsapp_automations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own automations" ON whatsapp_automations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automations" ON whatsapp_automations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own automations" ON whatsapp_automations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for whatsapp_logs
CREATE POLICY "Users can view their own logs" ON whatsapp_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = whatsapp_logs.lead_id
    AND leads.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert their own logs" ON whatsapp_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = whatsapp_logs.lead_id
    AND leads.user_id = auth.uid()
  )
);