-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'whatsapp', 'sms')),
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Templates policies
CREATE POLICY "Users can view all templates" ON message_templates FOR SELECT USING (true);
CREATE POLICY "Users can insert templates" ON message_templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their templates" ON message_templates FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their templates" ON message_templates FOR DELETE USING (auth.uid() = created_by);