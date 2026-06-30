-- Criar tabela de histórico de score das leads
CREATE TABLE IF NOT EXISTS lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  
  -- Componentes do score (para análise)
  response_time_score INTEGER,
  engagement_score INTEGER,
  budget_fit_score INTEGER,
  source_score INTEGER,
  recency_score INTEGER,
  
  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_reason TEXT, -- 'new_interaction', 'manual_recalc', 'daily_cron', etc.
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead_id ON lead_score_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_calculated_at ON lead_score_history(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead_date ON lead_score_history(lead_id, calculated_at DESC);

-- RLS: cada user só vê histórico das suas leads
ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead score history"
  ON lead_score_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lead score history"
  ON lead_score_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE lead_score_history IS 'Histórico de evolução do score comportamental de cada lead';
COMMENT ON COLUMN lead_score_history.response_time_score IS 'Pontuação baseada no tempo médio de resposta do consultor (0-20)';
COMMENT ON COLUMN lead_score_history.engagement_score IS 'Pontuação baseada no número e recência de interações (0-25)';
COMMENT ON COLUMN lead_score_history.budget_fit_score IS 'Pontuação baseada no fit entre orçamento da lead e carteira disponível (0-20)';
COMMENT ON COLUMN lead_score_history.source_score IS 'Pontuação baseada no canal de origem da lead (0-15)';
COMMENT ON COLUMN lead_score_history.recency_score IS 'Pontuação baseada em dias desde o último contacto (0-20)';