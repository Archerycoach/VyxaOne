-- Disponibilidades recorrentes no link de reservas.
--
-- Os blocos "disponível para reserva" passam a poder repetir-se (ex.: todas as
-- terças, 10h-11h, até 31/12). Cada ocorrência continua a ser uma linha em
-- calendar_events — o que mantém a compatibilidade com a reserva, a deteção
-- de conflitos e a sincronização com o Google — mas todas partilham o mesmo
-- recurrence_group_id, para poderem ser geridas como série.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.calendar_events
  add column if not exists recurrence_group_id uuid;

create index if not exists idx_calendar_events_recurrence_group
  on public.calendar_events(recurrence_group_id)
  where recurrence_group_id is not null;

-- Acelera a listagem de disponibilidades no link público de reservas.
create index if not exists idx_calendar_events_bookable
  on public.calendar_events(user_id, start_time)
  where is_bookable = true;

comment on column public.calendar_events.recurrence_group_id is
  'Agrupa as ocorrências de uma disponibilidade recorrente criada de uma só vez.';
