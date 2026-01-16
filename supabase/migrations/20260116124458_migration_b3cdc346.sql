-- Drop and recreate the function with secure search_path
DROP FUNCTION IF EXISTS public.update_lead_last_activity() CASCADE;

CREATE OR REPLACE FUNCTION public.update_lead_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Atualizar lead quando há nova interação
  IF TG_TABLE_NAME = 'interactions' THEN
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE leads 
      SET last_activity_date = COALESCE(NEW.interaction_date, NOW()),
          updated_at = NOW()
      WHERE id = NEW.lead_id;
    END IF;
  END IF;

  -- Atualizar lead quando há nova tarefa
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.related_lead_id IS NOT NULL THEN
      UPDATE leads 
      SET last_activity_date = NOW(),
          updated_at = NOW()
      WHERE id = NEW.related_lead_id;
    END IF;
  END IF;

  -- Atualizar lead quando há novo evento de calendário
  IF TG_TABLE_NAME = 'calendar_events' THEN
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE leads 
      SET last_activity_date = NOW(),
          updated_at = NOW()
      WHERE id = NEW.lead_id;
    END IF;
  END IF;

  -- Atualizar lead quando há nova nota
  IF TG_TABLE_NAME = 'lead_notes' THEN
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE leads 
      SET last_activity_date = NOW(),
          updated_at = NOW()
      WHERE id = NEW.lead_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate all triggers that use this function
DO $$
BEGIN
  -- Trigger for interactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_lead_last_activity_interactions'
  ) THEN
    CREATE TRIGGER trigger_update_lead_last_activity_interactions
      AFTER INSERT ON interactions
      FOR EACH ROW
      EXECUTE FUNCTION update_lead_last_activity();
  END IF;

  -- Trigger for tasks
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_lead_last_activity_tasks'
  ) THEN
    CREATE TRIGGER trigger_update_lead_last_activity_tasks
      AFTER INSERT ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_lead_last_activity();
  END IF;

  -- Trigger for calendar_events
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_lead_last_activity_calendar'
  ) THEN
    CREATE TRIGGER trigger_update_lead_last_activity_calendar
      AFTER INSERT ON calendar_events
      FOR EACH ROW
      EXECUTE FUNCTION update_lead_last_activity();
  END IF;

  -- Trigger for lead_notes
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_lead_last_activity_notes'
  ) THEN
    CREATE TRIGGER trigger_update_lead_last_activity_notes
      AFTER INSERT ON lead_notes
      FOR EACH ROW
      EXECUTE FUNCTION update_lead_last_activity();
  END IF;
END $$;