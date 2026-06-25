CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(255),
    business_account_id VARCHAR(255),
    access_token TEXT,
    verify_token VARCHAR(255),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_settings_select" ON whatsapp_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "whatsapp_settings_insert" ON whatsapp_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "whatsapp_settings_update" ON whatsapp_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "whatsapp_settings_delete" ON whatsapp_settings FOR DELETE USING (auth.uid() = user_id);