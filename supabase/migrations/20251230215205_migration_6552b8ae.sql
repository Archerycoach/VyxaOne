-- Adicionar campo notes à tabela tasks (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'notes'
  ) THEN
    ALTER TABLE tasks ADD COLUMN notes TEXT;
    COMMENT ON COLUMN tasks.notes IS 'Notas detalhadas adicionais sobre a tarefa';
  END IF;
END $$;