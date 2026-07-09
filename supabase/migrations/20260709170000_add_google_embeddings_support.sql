-- Suporte a embeddings da Google Gemini (768 dimensões) a par dos da OpenAI
-- (1536 dimensões, coluna "embedding" já existente) — dimensões diferentes
-- não podem coexistir na mesma coluna pgvector, por isso ficam em colunas
-- separadas. Cada memória usa a coluna correspondente ao fornecedor com que
-- foi gerada; a pesquisa semântica passa a comparar contra as duas.
ALTER TABLE lead_memory
  ADD COLUMN IF NOT EXISTS embedding_google vector(768);

CREATE INDEX IF NOT EXISTS idx_lead_memory_embedding_google ON lead_memory
  USING hnsw (embedding_google vector_cosine_ops);

DROP FUNCTION IF EXISTS match_lead_memory(uuid, vector(1536), int);

CREATE FUNCTION match_lead_memory(
  p_lead_id UUID,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_query_embedding_google vector(768) DEFAULT NULL,
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
  SELECT * FROM (
    SELECT
      lm.id,
      lm.lead_id,
      lm.source,
      lm.content,
      1 - (lm.embedding <=> p_query_embedding) AS similarity
    FROM lead_memory lm
    WHERE lm.lead_id = p_lead_id
      AND lm.embedding IS NOT NULL
      AND p_query_embedding IS NOT NULL

    UNION ALL

    SELECT
      lm.id,
      lm.lead_id,
      lm.source,
      lm.content,
      1 - (lm.embedding_google <=> p_query_embedding_google) AS similarity
    FROM lead_memory lm
    WHERE lm.lead_id = p_lead_id
      AND lm.embedding_google IS NOT NULL
      AND p_query_embedding_google IS NOT NULL
  ) combined
  ORDER BY similarity DESC
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_lead_memory TO authenticated;
