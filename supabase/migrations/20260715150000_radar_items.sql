-- Funcionalidade "Radar": acompanhamento ativo de leads/contactos quentes que
-- não podem ser esquecidos até serem resolvidos. Um item fica no radar até o
-- consultor o resolver; um cron diário avisa (notificações) se ficar parado
-- mais do que a cadência escolhida. Idempotente.

-- 1) Tabela de itens do radar (polimórfica: lead ou contacto).
CREATE TABLE IF NOT EXISTS public.radar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('lead', 'contact')),
  entity_id uuid NOT NULL,
  cadence_days integer NOT NULL DEFAULT 3 CHECK (cadence_days >= 1),
  note text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  last_nudge_at timestamptz,
  snooze_until timestamptz,
  resolved_at timestamptz,
  resolved_reason text CHECK (resolved_reason IN ('won', 'lost', 'not_interested', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo um item ATIVO por (utilizador, entidade).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_radar_active
  ON public.radar_items (user_id, entity_type, entity_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_radar_user_active
  ON public.radar_items (user_id)
  WHERE resolved_at IS NULL;

-- 2) RLS: o dono gere os seus; admin/broker podem consultar (supervisão).
ALTER TABLE public.radar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar owner all" ON public.radar_items;
CREATE POLICY "radar owner all" ON public.radar_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "radar admin read" ON public.radar_items;
CREATE POLICY "radar admin read" ON public.radar_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'broker'))
  );

-- 3) Repor o "relógio" automaticamente: qualquer interação registada numa lead
--    atualiza o last_activity_at do(s) item(ns) de radar dessa lead. Assim o
--    reset acontece independentemente de onde a interação é criada.
CREATE OR REPLACE FUNCTION public.radar_touch_on_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.radar_items
      SET last_activity_at = now(), updated_at = now()
      WHERE entity_type = 'lead' AND entity_id = NEW.lead_id AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radar_touch_on_interaction ON public.interactions;
CREATE TRIGGER trg_radar_touch_on_interaction
  AFTER INSERT ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.radar_touch_on_interaction();

-- 4) Default de cadência configurável (dias).
INSERT INTO public.system_settings (key, value)
VALUES ('radar_default_cadence_days', '3')
ON CONFLICT (key) DO NOTHING;
