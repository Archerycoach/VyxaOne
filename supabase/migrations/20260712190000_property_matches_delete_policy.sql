-- Permite ao consultor remover imóveis do portal do cliente (property_matches
-- das suas leads). A política de DELETE não foi recriada na migração
-- 20260101134708 (que recriou as outras), por isso a remoção podia falhar.
DROP POLICY IF EXISTS "Users can delete their property matches" ON property_matches;
CREATE POLICY "Users can delete their property matches" ON property_matches
  FOR DELETE
  USING (
    lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid())
  );
