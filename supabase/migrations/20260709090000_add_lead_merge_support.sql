-- Suporte para deteção e fusão de leads duplicadas.
--
-- merged_into regista para onde uma lead "perdedora" foi fundida, para que
-- fique rastreável/reversível (nunca apagamos a lead, só arquivamos).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES leads(id);

CREATE INDEX IF NOT EXISTS idx_leads_merged_into ON leads(merged_into);

-- Funde p_duplicate_id em p_primary_id: reatribui todo o histórico
-- (interações, notas, tarefas, documentos, negócios, etc.) para a lead
-- sobrevivente e arquiva a duplicada (não apaga nada).
--
-- Só broker/team_lead/admin podem fundir, e só dentro do conjunto de leads
-- que já conseguem ver (can_access_record), tal como o resto da app.
CREATE OR REPLACE FUNCTION merge_leads(p_primary_id uuid, p_duplicate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_primary_owner uuid;
  v_duplicate_owner uuid;
BEGIN
  IF p_primary_id = p_duplicate_id THEN
    RAISE EXCEPTION 'cannot_merge_same_lead';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'broker', 'team_lead') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT user_id INTO v_primary_owner FROM leads WHERE id = p_primary_id;
  SELECT user_id INTO v_duplicate_owner FROM leads WHERE id = p_duplicate_id;

  IF v_primary_owner IS NULL OR v_duplicate_owner IS NULL THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  IF NOT can_access_record(v_primary_owner) OR NOT can_access_record(v_duplicate_owner) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Tabelas 1:N simples, sem restrições UNIQUE em lead_id — reatribuir tudo.
  UPDATE calendar_events SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE contact_alert_requests SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE contact_opportunity_matches SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE deals SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE documents SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE interactions SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE lead_consents SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE lead_memory SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE lead_notes SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE lead_score_history SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE workflow_executions SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE tasks SET related_lead_id = p_primary_id WHERE related_lead_id = p_duplicate_id;

  -- Tabelas com UNIQUE envolvendo lead_id: só move o que não colide com algo
  -- que a lead sobrevivente já tenha; o que sobrar fica ligado à duplicada
  -- arquivada (histórico secundário, não vale a pena bloquear o merge por isso).
  UPDATE first_contact_alerts fca
    SET lead_id = p_primary_id
    WHERE fca.lead_id = p_duplicate_id
      AND NOT EXISTS (SELECT 1 FROM first_contact_alerts x WHERE x.lead_id = p_primary_id);

  UPDATE workflow_cadences wc
    SET lead_id = p_primary_id
    WHERE wc.lead_id = p_duplicate_id
      AND NOT EXISTS (
        SELECT 1 FROM workflow_cadences x
        WHERE x.lead_id = p_primary_id AND x.workflow_id = wc.workflow_id
      );

  UPDATE property_matches pm
    SET lead_id = p_primary_id
    WHERE pm.lead_id = p_duplicate_id
      AND NOT EXISTS (
        SELECT 1 FROM property_matches x
        WHERE x.lead_id = p_primary_id AND x.property_id = pm.property_id
      );

  UPDATE leads
    SET archived_at = COALESCE(archived_at, now()),
        archive_reason = 'Fundida com lead duplicada',
        merged_into = p_primary_id
    WHERE id = p_duplicate_id;
END;
$$;
