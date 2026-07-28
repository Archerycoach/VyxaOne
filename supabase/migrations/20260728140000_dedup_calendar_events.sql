-- ============================================================================
-- Limpeza dos eventos de calendário DUPLICADOS já existentes.
--
-- Remove cópias do MESMO compromisso — mesmo utilizador, mesmo título (sem
-- distinguir maiúsculas/espaços) e mesmo início AO MINUTO — mantendo apenas UM
-- por grupo. Preferência de qual manter: o que está ligado ao Google
-- (google_event_id preenchido) e, entre esses, o mais antigo. Assim o evento
-- que fica continua sincronizado e não vira órfão.
--
-- Conservador de propósito: só apaga linhas idênticas em título + minuto de
-- início (não agrupa por dia inteiro), para nunca remover eventos distintos.
--
-- Idempotente: correr de novo não encontra duplicados e não faz nada.
-- A prevenção de NOVOS duplicados está no código do sync (casamento por
-- conteúdo) — este SQL só limpa o que já lá está.
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728140000_dedup_calendar_events.sql
-- ============================================================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(btrim(title)), date_trunc('minute', start_time)
      ORDER BY (google_event_id IS NOT NULL) DESC, created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.calendar_events
)
DELETE FROM public.calendar_events c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;
