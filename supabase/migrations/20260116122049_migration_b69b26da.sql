-- Drop and recreate the function with secure search_path
DROP FUNCTION IF EXISTS public.trigger_visit_scheduled_workflow() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_visit_scheduled_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

-- Recreate the trigger if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_visit_workflow') THEN
    DROP TRIGGER trigger_visit_workflow ON calendar_events;
  END IF;
  
  CREATE TRIGGER trigger_visit_workflow
    AFTER INSERT ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_visit_scheduled_workflow();
END $$;