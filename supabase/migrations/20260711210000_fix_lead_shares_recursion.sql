-- A policy de lead_shares consultava a tabela leads diretamente (com RLS
-- normal), e as policies de leads passaram a consultar lead_shares (também
-- com RLS normal) — cada uma dispara a avaliação da outra, em ciclo:
-- "infinite recursion detected in policy for relation leads" (42P17).
--
-- Corrigido com uma função SECURITY DEFINER: ao correr como o dono da
-- tabela, ignora a RLS de "leads" e por isso quebra o ciclo (mesmo padrão
-- já usado por can_access_record/is_admin/etc. nesta base de dados).

CREATE OR REPLACE FUNCTION public.can_manage_lead_shares(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_assigned_to uuid;
BEGIN
  SELECT user_id, assigned_to INTO v_user_id, v_assigned_to FROM leads WHERE id = p_lead_id;
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN can_access_record(v_user_id) OR (v_assigned_to IS NOT NULL AND can_access_record(v_assigned_to));
END;
$$;

DROP POLICY IF EXISTS "manage lead shares if can access lead" ON lead_shares;
CREATE POLICY "manage lead shares if can access lead" ON lead_shares
  FOR ALL
  USING (can_manage_lead_shares(lead_id))
  WITH CHECK (can_manage_lead_shares(lead_id));
