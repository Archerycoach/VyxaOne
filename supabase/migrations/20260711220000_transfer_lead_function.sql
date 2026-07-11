-- A política de UPDATE da tabela leads (update_leads_hierarchy) usa a mesma
-- expressão como USING e como WITH CHECK. Ao transferir uma lead para outra
-- pessoa, a NOVA linha passa a ter assigned_to = destinatário; se quem
-- transfere não tiver acesso a esse destinatário (ex: um consultor que
-- recebeu a lead e a quer reencaminhar para fora da sua visibilidade), o
-- WITH CHECK falha -> "new row violates row-level security policy".
--
-- Solução (mesmo padrão de assign_consultant_to_manager, merge_leads, etc.):
-- uma função SECURITY DEFINER que corre como dono da tabela (ignora a RLS),
-- valida que quem chama TEM acesso à lead atual, e só então muda o
-- assigned_to. p_new_assigned_to pode ser NULL para deixar a lead sem
-- atribuição.

CREATE OR REPLACE FUNCTION public.transfer_lead(p_lead_id uuid, p_new_assigned_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_assigned_to uuid;
BEGIN
  SELECT user_id, assigned_to INTO v_user_id, v_assigned_to FROM leads WHERE id = p_lead_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  -- Quem chama tem de ter acesso à lead atual: dono, atribuído, hierarquia
  -- (broker/team lead via can_access_record), admin, ou partilha explícita.
  IF NOT (
    auth.uid() = v_user_id
    OR auth.uid() = v_assigned_to
    OR is_admin()
    OR can_access_record(v_user_id)
    OR (v_assigned_to IS NOT NULL AND can_access_record(v_assigned_to))
    OR EXISTS (SELECT 1 FROM lead_shares s WHERE s.lead_id = p_lead_id AND s.shared_with_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE leads SET assigned_to = p_new_assigned_to WHERE id = p_lead_id;
END;
$$;
