-- ============================================
-- CRIAR TRIGGER PARA AUTO-ATRIBUIÇÃO
-- Quando uma lead é criada, assigned_to = user_id automaticamente
-- ============================================

-- Função que atribui automaticamente o criador
CREATE OR REPLACE FUNCTION auto_assign_to_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- Se assigned_to está vazio, atribuir ao criador
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para LEADS
DROP TRIGGER IF EXISTS auto_assign_lead_to_creator ON leads;
CREATE TRIGGER auto_assign_lead_to_creator
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_creator();

-- Trigger para TASKS
DROP TRIGGER IF EXISTS auto_assign_task_to_creator ON tasks;
CREATE TRIGGER auto_assign_task_to_creator
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_creator();

-- Verificar se os triggers foram criados
SELECT 
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event,
  action_timing as timing
FROM information_schema.triggers
WHERE trigger_name LIKE 'auto_assign%'
ORDER BY event_object_table;