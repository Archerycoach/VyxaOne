-- Fases do pipeline (compra/venda) passam a ser configuráveis por consultor,
-- de forma isolada: cada consultor gere a sua própria lista de fases sem
-- afetar os colegas (decisão explícita do cliente — ganha-se flexibilidade,
-- perde-se a escala comum entre consultores nos relatórios agregados de
-- equipa, ex. Dashboard e Funil, que passam a usar a lista do próprio
-- utilizador/agente selecionado como referência).
CREATE TABLE IF NOT EXISTS pipeline_stage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage_type text NOT NULL CHECK (stage_type IN ('buyer', 'seller')),
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage_type)
);

ALTER TABLE pipeline_stage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage own pipeline stages" ON pipeline_stage_settings;
CREATE POLICY "manage own pipeline stages" ON pipeline_stage_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select team pipeline stages" ON pipeline_stage_settings;
CREATE POLICY "select team pipeline stages" ON pipeline_stage_settings
  FOR SELECT USING (can_access_record(user_id));
