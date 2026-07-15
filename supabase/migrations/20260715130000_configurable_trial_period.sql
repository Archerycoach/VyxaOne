-- Período de trial configurável (default 30 dias) + enforcement.
--
-- Contexto: até aqui o trial_ends_at nunca era definido no registo e o
-- SubscriptionGuard não estava montado, pelo que ninguém perdia acesso.
-- Esta migração:
--   1) Cria a definição configurável trial_period_days (default '30').
--   2) Preenche o trial_ends_at dos utilizadores existentes = registo + N dias.
--   3) Instala um trigger que carimba o trial_ends_at em cada novo registo.
--
-- Idempotente.

-- 1) Definição configurável (o admin pode alterar em Definições do Sistema).
INSERT INTO public.system_settings (key, value)
VALUES ('trial_period_days', '30')
ON CONFLICT (key) DO NOTHING;

-- 2) Backfill: utilizadores atuais passam a ter trial = data de registo + N dias.
--    (Só toca em linhas ainda sem trial_ends_at, por isso é reaplicável.)
DO $$
DECLARE days int;
BEGIN
  -- value é json/jsonb; #>> '{}' extrai o escalar como texto (aceita 30 ou "30").
  SELECT COALESCE(NULLIF(value #>> '{}', '')::int, 30) INTO days
  FROM public.system_settings WHERE key = 'trial_period_days';
  IF days IS NULL THEN days := 30; END IF;

  UPDATE public.profiles
    SET trial_ends_at = created_at + (days || ' days')::interval
    WHERE trial_ends_at IS NULL;
END $$;

-- 3) Novos registos: carimbar trial_ends_at = agora + N dias (se ainda não vier definido).
CREATE OR REPLACE FUNCTION public.set_default_trial_ends_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE days int;
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    SELECT COALESCE(NULLIF(value, '')::int, 30) INTO days
    FROM public.system_settings WHERE key = 'trial_period_days';
    IF days IS NULL THEN days := 30; END IF;
    NEW.trial_ends_at := now() + (days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_trial_ends_at ON public.profiles;
CREATE TRIGGER trg_set_default_trial_ends_at
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_trial_ends_at();
