CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own" ON ai_reports;
DROP POLICY IF EXISTS "insert_own" ON ai_reports;
DROP POLICY IF EXISTS "update_own" ON ai_reports;
DROP POLICY IF EXISTS "delete_own" ON ai_reports;

CREATE POLICY "select_own" ON ai_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON ai_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON ai_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON ai_reports FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own" ON ai_tasks;
DROP POLICY IF EXISTS "insert_own" ON ai_tasks;
DROP POLICY IF EXISTS "update_own" ON ai_tasks;
DROP POLICY IF EXISTS "delete_own" ON ai_tasks;

CREATE POLICY "select_own" ON ai_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON ai_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON ai_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON ai_tasks FOR DELETE USING (auth.uid() = user_id);