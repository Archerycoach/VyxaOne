-- Enable RLS for system_settings table but allow authenticated users to view
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- For simplicity in this iteration, we'll allow authenticated users to read system settings
-- Real production code would restrict this to only the necessary settings or use an RPC
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON system_settings;
CREATE POLICY "Enable read access for all authenticated users" ON system_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert/update access for all authenticated users temporarily" ON system_settings;
CREATE POLICY "Enable insert/update access for all authenticated users temporarily" ON system_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);