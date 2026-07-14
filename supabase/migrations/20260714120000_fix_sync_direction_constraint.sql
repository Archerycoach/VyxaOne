-- Alinha a constraint de sync_direction da tabela google_calendar_integrations
-- com a convenção usada por TODO o código da app (camelCase): 'both'/'toGoogle'/'fromGoogle'.
--
-- Contexto: a BD viva derivou para snake_case ('to_google'/'from_google') na
-- constraint CHECK, enquanto o código (src/lib/googleCalendar.ts, a edge function
-- google-calendar-auto-sync, o hook useGoogleCalendarSync e /api/google-calendar/sync)
-- compara sempre em camelCase. Resultado: linhas legadas em snake_case nunca batem
-- certo (a sincronização dessa direção é silenciosamente ignorada) e qualquer tentativa
-- de gravar 'toGoogle'/'fromGoogle' seria rejeitada pela constraint viva.
--
-- Esta migração é IDEMPOTENTE: pode ser reaplicada sem efeitos adversos.

DO $$
DECLARE
  c record;
BEGIN
  -- Se a tabela ainda não existir nesta base, não há nada a fazer.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_calendar_integrations'
  ) THEN
    RAISE NOTICE 'Tabela google_calendar_integrations inexistente; migração ignorada.';
    RETURN;
  END IF;

  -- 1) Remover qualquer CHECK constraint que refira sync_direction (o nome pode
  --    variar entre bases). Fazemo-lo dinamicamente para ser robusto.
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'google_calendar_integrations'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%sync_direction%'
  LOOP
    EXECUTE format('ALTER TABLE public.google_calendar_integrations DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- 2) Normalizar dados legados: snake_case -> camelCase.
  UPDATE public.google_calendar_integrations SET sync_direction = 'toGoogle'
    WHERE sync_direction = 'to_google';
  UPDATE public.google_calendar_integrations SET sync_direction = 'fromGoogle'
    WHERE sync_direction = 'from_google';

  -- 3) (Re)adicionar a constraint canónica em camelCase, igual ao código.
  --    Permitimos NULL (a coluna é anulável e tem DEFAULT 'both').
  ALTER TABLE public.google_calendar_integrations
    ADD CONSTRAINT google_calendar_integrations_sync_direction_check
    CHECK (sync_direction IS NULL OR sync_direction IN ('both', 'toGoogle', 'fromGoogle'));
END $$;
