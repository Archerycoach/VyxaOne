-- A página "Gestão de Equipa" (team.tsx) e o ScopeSelector ficaram numa
-- coluna antiga (profiles.manager_id) enquanto todo o resto da app
-- (Leads, Dashboard, Meta, crons) já usa profiles.team_lead_id. Os dados
-- reais confirmam que, onde já há relação definida, as duas colunas têm o
-- mesmo valor — por isso é seguro consolidar tudo em team_lead_id.
--
-- get_team_overview() nunca chegou a ficar registada numa migração (por
-- isso "Gestão de Equipa" dava erro a carregar).
CREATE OR REPLACE FUNCTION get_team_overview()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role user_role,
  manager_id uuid,
  manager_name text,
  total_leads bigint,
  active_leads bigint,
  last_login timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  visible_ids uuid[];
BEGIN
  visible_ids := get_visible_user_ids();

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.team_lead_id,
    tl.full_name,
    COALESCE((SELECT COUNT(*) FROM leads l WHERE l.assigned_to = p.id), 0),
    COALESCE(
      (SELECT COUNT(*) FROM leads l
       WHERE l.assigned_to = p.id AND l.archived_at IS NULL AND l.status NOT IN ('won', 'lost')),
      0
    ),
    u.last_sign_in_at,
    p.created_at
  FROM profiles p
  LEFT JOIN profiles tl ON tl.id = p.team_lead_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = ANY(visible_ids)
  ORDER BY p.full_name;
END;
$$;

-- Escrevia em manager_id, que mais nenhuma feature da app lê — a atribuição
-- de team lead nesta página não tinha qualquer efeito em Leads/Dashboard.
-- DROP primeiro porque a assinatura/tipo de retorno já existente é diferente
-- (CREATE OR REPLACE não permite mudar isso).
DROP FUNCTION IF EXISTS assign_consultant_to_manager(uuid, uuid);

CREATE OR REPLACE FUNCTION assign_consultant_to_manager(consultant_id uuid, new_manager_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_target_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'broker') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT role INTO v_target_role FROM profiles WHERE id = consultant_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF new_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = new_manager_id AND role = 'team_lead'
  ) THEN
    RAISE EXCEPTION 'manager_must_be_team_lead';
  END IF;

  UPDATE profiles SET team_lead_id = new_manager_id WHERE id = consultant_id;
END;
$$;

-- Mesmo alinhamento no ScopeSelector, para não voltar a divergir agora que
-- assign_consultant_to_manager passa a escrever só em team_lead_id.
CREATE OR REPLACE FUNCTION get_visible_users_with_details()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role user_role,
  manager_id uuid,
  is_own_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
  current_user_id uuid;
BEGIN
  visible_users := get_visible_user_ids();
  current_user_id := auth.uid();

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.team_lead_id,
    (p.id = current_user_id) as is_own_record
  FROM profiles p
  WHERE p.id = ANY(visible_users)
  ORDER BY
    CASE
      WHEN p.id = current_user_id THEN 0
      ELSE 1
    END,
    p.full_name;
END;
$$;
