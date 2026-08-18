-- Reservas feitas por clientes (link de agendamento): flag própria, para o
-- consultor as poder listar no calendário (planeadas vs. realizadas) sem
-- depender de heurísticas sobre o título/descrição.
alter table calendar_events add column if not exists booked_by_client boolean not null default false;

-- Backfill dos agendamentos antigos: o endpoint de confirmação escreve sempre
-- esta descrição na primeira linha, é o identificador fiável dos existentes.
update calendar_events
set booked_by_client = true
where booked_by_client = false
  and description like 'Reserva feita pelo cliente através do link de agendamento.%';
