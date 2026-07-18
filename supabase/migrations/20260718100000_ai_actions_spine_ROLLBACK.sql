-- Rollback da espinha de ações da IA (20260718100000_ai_actions_spine.sql).
--
-- ATENÇÃO: apagar a tabela ai_actions destrói o histórico do que a IA fez e
-- as propostas ainda por decidir. Se o objetivo for apenas desligar a
-- funcionalidade, prefere pôr as capacidades em 'off' nas definições em vez
-- de correr este rollback.

drop policy if exists "select own ai actions" on public.ai_actions;
drop policy if exists "update own ai actions" on public.ai_actions;
drop policy if exists "insert own ai actions" on public.ai_actions;

drop index if exists idx_ai_actions_user_status;
drop index if exists idx_ai_actions_lead;
drop index if exists idx_ai_actions_entity;

drop table if exists public.ai_actions;

alter table public.profiles
  drop column if exists ai_capability_levels;
