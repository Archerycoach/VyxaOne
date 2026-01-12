-- 1. Adicionar nova coluna para múltiplas ações
ALTER TABLE lead_workflow_rules 
ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar dados existentes para o novo formato
UPDATE lead_workflow_rules 
SET actions = jsonb_build_array(
  jsonb_build_object(
    'type', action_type,
    'config', action_config,
    'daysOffset', delay_days,
    'hoursOffset', delay_hours
  )
)
WHERE actions = '[]'::jsonb OR actions IS NULL;

-- 3. Remover colunas obsoletas (opcional, mas recomendado para limpeza)
-- ALTER TABLE lead_workflow_rules DROP COLUMN action_type;
-- ALTER TABLE lead_workflow_rules DROP COLUMN action_config;
-- ALTER TABLE lead_workflow_rules DROP COLUMN delay_days;
-- ALTER TABLE lead_workflow_rules DROP COLUMN delay_hours;