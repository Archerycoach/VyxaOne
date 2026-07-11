-- Permite a qualquer utilizador que já tenha acesso a uma lead (dono,
-- atribuído, ou broker/team_lead via hierarquia) partilhá-la com outro
-- utilizador qualquer, mantendo o "assigned_to" original — ao contrário de
-- transferir (que substitui o atribuído), partilhar dá acesso adicional
-- sem remover o acesso de quem já tinha.

CREATE TABLE IF NOT EXISTS lead_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, shared_with_user_id)
);

COMMENT ON TABLE lead_shares IS 'Concede a shared_with_user_id acesso a uma lead específica, sem alterar leads.assigned_to.';

ALTER TABLE lead_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage lead shares if can access lead" ON lead_shares;
CREATE POLICY "manage lead shares if can access lead" ON lead_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_shares.lead_id
      AND (can_access_record(l.user_id) OR (l.assigned_to IS NOT NULL AND can_access_record(l.assigned_to)))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_shares.lead_id
      AND (can_access_record(l.user_id) OR (l.assigned_to IS NOT NULL AND can_access_record(l.assigned_to)))
    )
  );

DROP POLICY IF EXISTS "shared user sees own incoming shares" ON lead_shares;
CREATE POLICY "shared user sees own incoming shares" ON lead_shares
  FOR SELECT
  USING (shared_with_user_id = auth.uid());

-- Estende a visibilidade/edição de leads para incluir leads partilhadas.
DROP POLICY IF EXISTS "select_leads_hierarchy" ON leads;
CREATE POLICY "select_leads_hierarchy" ON leads
  FOR SELECT
  USING (
    can_access_record(user_id)
    OR (assigned_to IS NOT NULL AND can_access_record(assigned_to))
    OR EXISTS (SELECT 1 FROM lead_shares s WHERE s.lead_id = leads.id AND s.shared_with_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_leads_hierarchy" ON leads;
CREATE POLICY "update_leads_hierarchy" ON leads
  FOR UPDATE
  USING (
    can_access_record(user_id)
    OR (assigned_to IS NOT NULL AND can_access_record(assigned_to))
    OR EXISTS (SELECT 1 FROM lead_shares s WHERE s.lead_id = leads.id AND s.shared_with_user_id = auth.uid())
  );
