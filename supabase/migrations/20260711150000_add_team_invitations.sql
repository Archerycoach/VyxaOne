-- Permite a um team lead convidar um consultor sem equipa para se juntar à
-- sua equipa. O consultor recebe uma notificação (com botões de
-- Aceitar/Rejeitar na app) e, ao aceitar, profiles.team_lead_id é atualizado
-- automaticamente — sem intervenção do broker/admin.
CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_lead_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

-- Só um convite pendente por consultor, de qualquer team lead, evitando
-- convites simultâneos em conflito.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_pending_consultant
  ON team_invitations (consultant_id)
  WHERE status = 'pending';

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver convites próprios" ON team_invitations;
CREATE POLICY "ver convites próprios" ON team_invitations
  FOR SELECT USING (team_lead_id = auth.uid() OR consultant_id = auth.uid() OR is_admin());

-- Sem políticas de INSERT/UPDATE diretas de propósito: a criação e resposta
-- a convites só passa pelas funções abaixo (SECURITY DEFINER), que aplicam
-- as regras de negócio (só consultores sem equipa, um convite pendente por
-- vez, só o próprio consultor pode responder ao seu convite).

CREATE OR REPLACE FUNCTION public.send_team_invitation(p_consultant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role user_role;
  v_target_role user_role;
  v_target_team_lead_id uuid;
  v_caller_name text;
  v_invitation_id uuid;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('team_lead', 'broker', 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT role, team_lead_id INTO v_target_role, v_target_team_lead_id
  FROM profiles WHERE id = p_consultant_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'consultant_not_found';
  END IF;

  IF v_target_role != 'consultant' THEN
    RAISE EXCEPTION 'target_is_not_consultant';
  END IF;

  IF v_target_team_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'consultant_already_in_team';
  END IF;

  IF EXISTS (SELECT 1 FROM team_invitations WHERE consultant_id = p_consultant_id AND status = 'pending') THEN
    RAISE EXCEPTION 'consultant_has_pending_invitation';
  END IF;

  SELECT full_name INTO v_caller_name FROM profiles WHERE id = auth.uid();

  INSERT INTO team_invitations (team_lead_id, consultant_id)
  VALUES (auth.uid(), p_consultant_id)
  RETURNING id INTO v_invitation_id;

  INSERT INTO notifications (user_id, title, message, notification_type, is_read, related_entity_id, related_entity_type, data)
  VALUES (
    p_consultant_id,
    'Convite para equipa',
    COALESCE(v_caller_name, 'Um team lead') || ' convidou-o(a) para se juntar à sua equipa.',
    'team_invitation',
    false,
    v_invitation_id,
    'team_invitation',
    jsonb_build_object('invitationId', v_invitation_id, 'teamLeadId', auth.uid(), 'teamLeadName', v_caller_name)
  );

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team_lead_id uuid;
  v_consultant_id uuid;
  v_status text;
BEGIN
  SELECT team_lead_id, consultant_id, status INTO v_team_lead_id, v_consultant_id, v_status
  FROM team_invitations WHERE id = p_invitation_id;

  IF v_consultant_id IS NULL THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_consultant_id != auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'invitation_already_answered';
  END IF;

  UPDATE team_invitations SET status = 'accepted', responded_at = now() WHERE id = p_invitation_id;
  UPDATE profiles SET team_lead_id = v_team_lead_id WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_team_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_consultant_id uuid;
  v_status text;
BEGIN
  SELECT consultant_id, status INTO v_consultant_id, v_status
  FROM team_invitations WHERE id = p_invitation_id;

  IF v_consultant_id IS NULL THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_consultant_id != auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'invitation_already_answered';
  END IF;

  UPDATE team_invitations SET status = 'declined', responded_at = now() WHERE id = p_invitation_id;
END;
$$;
