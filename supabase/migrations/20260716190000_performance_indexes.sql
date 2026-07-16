-- Índices de performance para as consultas mais frequentes das automações
-- (análise automática de IA, reativação, sincronização Google, notificações).
--
-- Preventivo: com as tabelas pequenas a diferença é invisível, mas evita a
-- degradação quando tiverem centenas de milhares de linhas (300-400
-- utilizadores). Todos os índices são "if not exists" — idempotente, pode
-- correr mais do que uma vez em qualquer base.

-- Análise automática de IA: histórico recente por lead (ordenado por data).
create index if not exists idx_interactions_lead_date
  on public.interactions (lead_id, interaction_date desc);

create index if not exists idx_lead_notes_lead_created
  on public.lead_notes (lead_id, created_at desc);

-- Reativação de leads: contagem dos emails de reativação já enviados por lead
-- (escolha do template 1/2/3) e página "Emails Automáticos" por utilizador.
-- Defensivo (DO block): a tabela automated_email_log foi criada diretamente
-- nas bases vivas (drift conhecido — não está nas migrações do repo), por
-- isso confirmamos a existência da tabela/colunas antes de indexar.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'automated_email_log' and column_name = 'status'
  ) then
    create index if not exists idx_automated_email_log_lead_source_status
      on public.automated_email_log (lead_id, source, status);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'automated_email_log' and column_name = 'created_at'
  ) then
    create index if not exists idx_automated_email_log_user_created
      on public.automated_email_log (user_id, created_at desc);
  end if;
end $$;

-- Campainha de notificações: não lidas por utilizador, mais recentes primeiro.
create index if not exists idx_notifications_user_read_created
  on public.notifications (user_id, is_read, created_at desc);

-- Calendário: listagem por utilizador ordenada por início.
create index if not exists idx_calendar_events_user_start
  on public.calendar_events (user_id, start_time);

-- Exportação para o Google: só eventos ainda sem google_event_id (índice
-- parcial — pequeno e exatamente a query do sync).
create index if not exists idx_calendar_events_unsynced
  on public.calendar_events (user_id, start_time)
  where google_event_id is null;

-- Memória de longo prazo da IA (lead_memory) e consentimentos WhatsApp
-- (lead_consents): defensivo, porque nem todas as bases receberam todas as
-- migrações (drift conhecido). Se a tabela faltar, o índice é ignorado e fica
-- um aviso no output — sinal de que essa base precisa de ser posta em dia.
do $$
begin
  if to_regclass('public.lead_memory') is not null then
    create index if not exists idx_lead_memory_lead
      on public.lead_memory (lead_id, created_at desc);
  else
    raise notice 'DRIFT: tabela lead_memory NÃO existe nesta base — falta a migração 20260626151337 (memória de IA). Índice ignorado.';
  end if;

  if to_regclass('public.lead_consents') is not null then
    create index if not exists idx_lead_consents_lead_channel_created
      on public.lead_consents (lead_id, channel, created_at desc);
  else
    raise notice 'DRIFT: tabela lead_consents NÃO existe nesta base — consentimentos WhatsApp em falta. Índice ignorado.';
  end if;
end $$;

-- Tarefas ligadas a leads: contadores nos cartões de lead e agenda.
create index if not exists idx_tasks_related_lead
  on public.tasks (related_lead_id)
  where related_lead_id is not null;
