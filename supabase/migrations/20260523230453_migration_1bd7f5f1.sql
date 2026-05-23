ALTER TABLE notion_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notion_integrations" ON notion_integrations;
CREATE POLICY "select_own_notion_integrations" ON notion_integrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notion_integrations" ON notion_integrations;
CREATE POLICY "delete_own_notion_integrations" ON notion_integrations FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notion_integrations" ON notion_integrations;
CREATE POLICY "update_own_notion_integrations" ON notion_integrations FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE notion_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notion_mappings" ON notion_mappings;
CREATE POLICY "select_own_notion_mappings" ON notion_mappings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notion_mappings" ON notion_mappings;
CREATE POLICY "insert_own_notion_mappings" ON notion_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notion_mappings" ON notion_mappings;
CREATE POLICY "update_own_notion_mappings" ON notion_mappings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notion_mappings" ON notion_mappings;
CREATE POLICY "delete_own_notion_mappings" ON notion_mappings FOR DELETE USING (auth.uid() = user_id);