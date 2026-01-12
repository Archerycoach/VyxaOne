-- FASE 1: Adicionar campos essenciais à tabela leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS important_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMPTZ;

COMMENT ON COLUMN leads.birthday IS 'Data de nascimento da lead';
COMMENT ON COLUMN leads.important_dates IS 'Array de datas importantes: [{"date": "2026-06-15", "label": "Aniversário de casamento"}]';
COMMENT ON COLUMN leads.last_activity_date IS 'Última data de qualquer atividade (interação, tarefa, evento)';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_birthday ON leads(birthday) WHERE birthday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_activity ON leads(last_activity_date) WHERE last_activity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_important_dates ON leads USING GIN(important_dates) WHERE important_dates != '[]'::jsonb;

-- Inicializar last_activity_date com base em last_contact_date ou created_at
UPDATE leads 
SET last_activity_date = COALESCE(last_contact_date, created_at)
WHERE last_activity_date IS NULL;

-- ====================================================================
-- TRIGGERS AUTOMÁTICOS PARA ATUALIZAR last_activity_date
-- ====================================================================

-- Função para atualizar last_activity_date automaticamente
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar lead quando há nova interação
  IF TG_TABLE_NAME = 'interactions' AND NEW.lead_id IS NOT NULL THEN
    UPDATE leads 
    SET last_activity_date = COALESCE(NEW.interaction_date, NOW()),
        updated_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;

  -- Atualizar lead quando há nova tarefa
  IF TG_TABLE_NAME = 'tasks' AND NEW.related_lead_id IS NOT NULL THEN
    UPDATE leads 
    SET last_activity_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.related_lead_id;
  END IF;

  -- Atualizar lead quando há novo evento de calendário
  IF TG_TABLE_NAME = 'calendar_events' AND NEW.lead_id IS NOT NULL THEN
    UPDATE leads 
    SET last_activity_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;

  -- Atualizar lead quando há nova nota
  IF TG_TABLE_NAME = 'lead_notes' AND NEW.lead_id IS NOT NULL THEN
    UPDATE leads 
    SET last_activity_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para cada tabela relevante
DROP TRIGGER IF EXISTS trigger_update_lead_activity_on_interaction ON interactions;
CREATE TRIGGER trigger_update_lead_activity_on_interaction
AFTER INSERT OR UPDATE ON interactions
FOR EACH ROW 
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION update_lead_last_activity();

DROP TRIGGER IF EXISTS trigger_update_lead_activity_on_task ON tasks;
CREATE TRIGGER trigger_update_lead_activity_on_task
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW 
WHEN (NEW.related_lead_id IS NOT NULL)
EXECUTE FUNCTION update_lead_last_activity();

DROP TRIGGER IF EXISTS trigger_update_lead_activity_on_event ON calendar_events;
CREATE TRIGGER trigger_update_lead_activity_on_event
AFTER INSERT OR UPDATE ON calendar_events
FOR EACH ROW 
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION update_lead_last_activity();

DROP TRIGGER IF EXISTS trigger_update_lead_activity_on_note ON lead_notes;
CREATE TRIGGER trigger_update_lead_activity_on_note
AFTER INSERT OR UPDATE ON lead_notes
FOR EACH ROW 
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION update_lead_last_activity();

-- ====================================================================
-- TRIGGER AUTOMÁTICO PARA WORKFLOWS QUANDO VISITA É AGENDADA
-- ====================================================================

-- Função para disparar workflow quando evento de visita é criado
CREATE OR REPLACE FUNCTION trigger_visit_scheduled_workflow()
RETURNS TRIGGER AS $$
DECLARE
  v_workflow_rule RECORD;
BEGIN
  -- Apenas processar se for evento de visita e tiver lead_id
  IF NEW.lead_id IS NOT NULL AND NEW.event_type = 'visit' THEN
    
    -- Buscar workflows ativos com trigger "visit_scheduled"
    FOR v_workflow_rule IN 
      SELECT * FROM lead_workflow_rules 
      WHERE enabled = true 
      AND trigger_status = 'visit_scheduled'
      AND user_id = NEW.user_id
    LOOP
      -- Inserir execução pendente do workflow
      INSERT INTO workflow_executions (
        workflow_id,
        lead_id,
        user_id,
        status,
        executed_at
      ) VALUES (
        v_workflow_rule.id,
        NEW.lead_id,
        NEW.user_id,
        'pending',
        NOW() + 
          (v_workflow_rule.delay_days || ' days')::INTERVAL + 
          (v_workflow_rule.delay_hours || ' hours')::INTERVAL
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para disparar workflow em visitas
DROP TRIGGER IF EXISTS trigger_visit_scheduled_workflow ON calendar_events;
CREATE TRIGGER trigger_visit_scheduled_workflow
AFTER INSERT ON calendar_events
FOR EACH ROW 
WHEN (NEW.lead_id IS NOT NULL AND NEW.event_type = 'visit')
EXECUTE FUNCTION trigger_visit_scheduled_workflow();