-- Análise automática de IA nas leads (notas de voz + notas/interações)
--
-- 1. profiles.lead_auto_analysis_enabled — toggle por consultor (ligado por
--    defeito): quando uma nota/interação é adicionada a uma lead, a IA
--    analisa e aplica temperatura/status/tarefas, cria blocos de agenda
--    "por confirmar" e notifica o consultor.
-- 2. leads.last_ai_analysis_at — debounce: evita análises duplicadas quando
--    o consultor adiciona vários registos seguidos à mesma lead.
-- 3. calendar_events.ai_pending — eventos criados pela IA que aguardam
--    confirmação do consultor no calendário (NÃO confundir com
--    requires_confirmation, que é a confirmação pedida à LEAD via WhatsApp).
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

alter table public.profiles
  add column if not exists lead_auto_analysis_enabled boolean not null default true;

alter table public.leads
  add column if not exists last_ai_analysis_at timestamptz;

alter table public.calendar_events
  add column if not exists ai_pending boolean not null default false;
