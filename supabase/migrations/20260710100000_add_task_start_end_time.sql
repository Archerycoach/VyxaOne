-- As tarefas só tinham uma data de vencimento (sem hora); passam a poder
-- ter também hora de início e de fim, tal como os eventos do calendário.
-- due_date mantém-se (continua a ser a data/hora de referência usada pelos
-- lembretes e ordenações já existentes) — start_time/end_time são novos e
-- aditivos, só para quem quiser dar duração à tarefa.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz;
