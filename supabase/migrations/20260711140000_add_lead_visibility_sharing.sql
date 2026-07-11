-- Permite a cada team lead partilhar a visibilidade das SUAS PRÓPRIAS leads
-- com consultores específicos (lead_visibility_grants), ou ativar um "modo
-- equipa" (profiles.team_shares_all_leads) em que todos os membros da sua
-- equipa passam a ver as leads uns dos outros. Decisão de negócio: brokers
-- continuam a ver e gerir tudo sempre; team leads continuam a gerir a sua
-- equipa como já acontecia — só o ramo do consultor em get_visible_user_ids()
-- é estendido.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS team_shares_all_leads boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.team_shares_all_leads IS 'Quando true (definido pelo próprio team lead), todos os consultores desta equipa (team_lead_id = este utilizador) passam a ver as leads uns dos outros, não só as próprias.';

CREATE TABLE IF NOT EXISTS lead_visibility_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_lead_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_lead_id, consultant_id)
);

COMMENT ON TABLE lead_visibility_grants IS 'Um team lead concede a um consultor específico visibilidade sobre as PRÓPRIAS leads do team lead (não sobre toda a equipa — ver profiles.team_shares_all_leads para isso).';

ALTER TABLE lead_visibility_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team lead manages own grants" ON lead_visibility_grants;
CREATE POLICY "team lead manages own grants" ON lead_visibility_grants
  FOR ALL USING (team_lead_id = auth.uid() OR is_admin())
  WITH CHECK (team_lead_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "consultant sees own incoming grants" ON lead_visibility_grants;
CREATE POLICY "consultant sees own incoming grants" ON lead_visibility_grants
  FOR SELECT USING (consultant_id = auth.uid());

-- Estende get_visible_user_ids(): mantém o comportamento de broker/admin
-- (tudo) e team_lead (equipa) exatamente como estava; só o consultor
-- ("ELSE") passa a incluir também os team leads que lhe deram grant, e —
-- se o seu próprio team lead tiver ativado o modo equipa — o team lead e
-- todos os colegas dessa equipa.
CREATE OR REPLACE FUNCTION public.get_visible_user_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_team_lead_id uuid;
  v_result uuid[];
BEGIN
  SELECT role::text, team_lead_id INTO v_role, v_team_lead_id
  FROM profiles WHERE id = auth.uid();

  IF v_role IN ('broker', 'admin') THEN
    RETURN ARRAY(SELECT id FROM profiles);
  END IF;

  IF v_role = 'team_lead' THEN
    RETURN ARRAY(
      SELECT id FROM profiles
      WHERE id = auth.uid()
         OR manager_id = auth.uid()
         OR team_lead_id = auth.uid()
    );
  END IF;

  -- Consultor: sempre a si próprio, mais quaisquer partilhas explícitas.
  v_result := ARRAY[auth.uid()];

  v_result := v_result || COALESCE(
    (SELECT array_agg(team_lead_id) FROM lead_visibility_grants WHERE consultant_id = auth.uid()),
    ARRAY[]::uuid[]
  );

  IF v_team_lead_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_team_lead_id AND team_shares_all_leads = true) THEN
      v_result := v_result || v_team_lead_id;
      v_result := v_result || COALESCE(
        ARRAY(SELECT id FROM profiles WHERE team_lead_id = v_team_lead_id),
        ARRAY[]::uuid[]
      );
    END IF;
  END IF;

  RETURN ARRAY(SELECT DISTINCT unnest(v_result));
END;
$function$;
