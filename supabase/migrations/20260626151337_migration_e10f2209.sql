-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create lead_memory table for long-term AI memory
CREATE TABLE IF NOT EXISTS lead_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'note', 'interaction', 'task', 'email', etc.
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_memory_lead_id ON lead_memory(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_memory_user_id ON lead_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_memory_created_at ON lead_memory(created_at DESC);

-- 4. Create vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_lead_memory_embedding ON lead_memory 
  USING hnsw (embedding vector_cosine_ops);

-- 5. Enable RLS
ALTER TABLE lead_memory ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: users can only see their own memory
CREATE POLICY "select_own_memory" ON lead_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own_memory" ON lead_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_memory" ON lead_memory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own_memory" ON lead_memory
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Create function for semantic search (returns most relevant memories for a lead)
CREATE OR REPLACE FUNCTION match_lead_memory(
  p_lead_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  lead_id UUID,
  source TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lead_memory.id,
    lead_memory.lead_id,
    lead_memory.source,
    lead_memory.content,
    1 - (lead_memory.embedding <=> p_query_embedding) AS similarity
  FROM lead_memory
  WHERE lead_memory.lead_id = p_lead_id
    AND lead_memory.embedding IS NOT NULL
  ORDER BY lead_memory.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- 8. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION match_lead_memory TO authenticated;