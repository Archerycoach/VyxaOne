-- 1. Adicionar coluna 'steps' à tabela lead_workflow_rules para suportar sequências
-- Formato JSON: [
--   { "delay_days": 0, "action_type": "send_email", "config": {...} },
--   { "delay_days": 3, "action_type": "send_whatsapp", "config": {...} },
--   { "delay_days": 7, "action_type": "create_task", "config": {...} }
-- ]
ALTER TABLE lead_workflow_rules
ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stop_on_response boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cadence_type text CHECK (cadence_type IN ('simple', 'sequence')) DEFAULT 'simple';

COMMENT ON COLUMN lead_workflow_rules.steps IS 'Array de passos da cadência com delays e ações';
COMMENT ON COLUMN lead_workflow_rules.stop_on_response IS 'Se TRUE, para a cadência quando o lead responder';
COMMENT ON COLUMN lead_workflow_rules.cadence_type IS 'Tipo de workflow: simple (ação única) ou sequence (cadência multi-passo)';

-- 2. Criar tabela workflow_cadences para rastrear execuções de cadências ativas
CREATE TABLE IF NOT EXISTS workflow_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES lead_workflow_rules(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_step integer DEFAULT 0 NOT NULL,
  status text CHECK (status IN ('active', 'paused', 'completed', 'stopped')) DEFAULT 'active',
  next_execution_date timestamptz,
  stopped_reason text,
  started_at timestamptz DEFAULT now() NOT NULL,
  last_executed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workflow_id, lead_id) -- Uma cadência por workflow+lead
);

COMMENT ON TABLE workflow_cadences IS 'Rastreia estado de cadências ativas (sequências de follow-up)';
COMMENT ON COLUMN workflow_cadences.current_step IS 'Índice do próximo passo a executar (0-based)';
COMMENT ON COLUMN workflow_cadences.status IS 'Estado: active (em execução), paused (pausada manualmente), completed (todos passos executados), stopped (parada por resposta do lead)';
COMMENT ON COLUMN workflow_cadences.next_execution_date IS 'Data agendada para executar o próximo passo';
COMMENT ON COLUMN workflow_cadences.stopped_reason IS 'Razão de paragem (ex: "Lead respondeu via WhatsApp")';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_workflow_cadences_next_execution ON workflow_cadences(next_execution_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workflow_cadences_lead ON workflow_cadences(lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cadences_workflow ON workflow_cadences(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cadences_user ON workflow_cadences(user_id);

-- RLS para workflow_cadences
ALTER TABLE workflow_cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cadences"
  ON workflow_cadences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cadences"
  ON workflow_cadences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cadences"
  ON workflow_cadences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cadences"
  ON workflow_cadences FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Criar tabela workflow_step_executions para histórico detalhado de cada passo
CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id uuid REFERENCES workflow_cadences(id) ON DELETE CASCADE NOT NULL,
  step_index integer NOT NULL,
  action_type text NOT NULL,
  action_config jsonb,
  status text CHECK (status IN ('pending', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
  error_message text,
  executed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE workflow_step_executions IS 'Histórico detalhado de execução de cada passo de cadências';

-- Índices
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_cadence ON workflow_step_executions(cadence_id);

-- RLS para workflow_step_executions
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own step executions"
  ON workflow_step_executions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workflow_cadences 
    WHERE workflow_cadences.id = workflow_step_executions.cadence_id 
    AND workflow_cadences.user_id = auth.uid()
  ));

CREATE POLICY "System can insert step executions"
  ON workflow_step_executions FOR INSERT
  WITH CHECK (true);