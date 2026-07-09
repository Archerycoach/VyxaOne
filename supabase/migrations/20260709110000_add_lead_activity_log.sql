-- Log de atividade/auditoria por lead: quem editou, reatribuiu, mudou o
-- estado, arquivou ou fundiu cada lead, e quando. Não regista visualizações
-- (só alterações), para não gerar volume desnecessário de escrita.
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL, -- 'updated' | 'reassigned' | 'status_changed' | 'archived' | 'restored' | 'merged'
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id ON lead_activity_log(lead_id, created_at DESC);

ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select lead activity if can access lead" ON lead_activity_log;
CREATE POLICY "select lead activity if can access lead" ON lead_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_activity_log.lead_id
        AND (l.user_id = auth.uid() OR can_access_record(l.user_id))
    )
  );

DROP POLICY IF EXISTS "insert own lead activity" ON lead_activity_log;
CREATE POLICY "insert own lead activity" ON lead_activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Regista também a fusão de duplicados no histórico da lead sobrevivente.
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
  UPDATE lead_activity_log SET lead_id = p_primary_id WHERE lead_id = p_duplicate_id;
  UPDATE tasks SET related_lead_id = p_primary_id WHERE related_lead_id = p_duplicate_id;

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

  INSERT INTO lead_activity_log (lead_id, user_id, action, field_name, old_value, new_value)
  VALUES (p_primary_id, auth.uid(), 'merged', 'merged_into', p_duplicate_id::text, p_primary_id::text);
END;
$$;
