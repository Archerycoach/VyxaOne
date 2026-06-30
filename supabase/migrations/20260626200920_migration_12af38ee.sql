-- =============================================================================
-- CORRIGIR: Aplicar visibilidade hierárquica APENAS em tabelas existentes
-- =============================================================================

-- PASSO 2 CORRIGIDO: Apenas tabelas de dados de negócio que referenciam profiles.id

-- 2.1: LEADS (já atualizado anteriormente, manter)
-- 2.2: PROPERTIES (já atualizado anteriormente, manter)
-- 2.3: CONTACTS (já atualizado anteriormente, manter)
-- 2.4: TASKS (já atualizado anteriormente, manter)
-- 2.5: INTERACTIONS (já atualizado anteriormente, manter)
-- 2.6: CALENDAR_EVENTS (já atualizado anteriormente com View calendar events by hierarchy)
-- 2.7: LEAD_NOTES (não NOTES - corrigir nome)

DROP POLICY IF EXISTS "Users can view accessible lead notes" ON lead_notes;
DROP POLICY IF EXISTS "Users can insert own lead notes" ON lead_notes;
DROP POLICY IF EXISTS "Users can update accessible lead notes" ON lead_notes;
DROP POLICY IF EXISTS "Users can delete own lead notes or admin" ON lead_notes;

CREATE POLICY "Users can view accessible lead notes" ON lead_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_notes.lead_id
        AND (can_access_record(l.user_id) OR (l.assigned_to IS NOT NULL AND can_access_record(l.assigned_to)))
    )
  );

CREATE POLICY "Users can insert own lead notes" ON lead_notes
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update accessible lead notes" ON lead_notes
  FOR UPDATE
  USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "Users can delete own lead notes or admin" ON lead_notes
  FOR DELETE
  USING (auth.uid() = created_by OR is_admin());

-- 2.8: DEVELOPMENTS (já atualizado anteriormente, manter)
-- 2.9: CONTACT_ALERT_REQUESTS (já atualizado anteriormente, manter)
-- 2.10: PROPERTY_REQUESTS (já atualizado anteriormente, manter)

-- 2.11: DOCUMENTS - aplicar visibilidade hierárquica
DROP POLICY IF EXISTS "Users can view accessible documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update accessible documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents or admin" ON documents;

CREATE POLICY "Users can view accessible documents" ON documents
  FOR SELECT
  USING (can_access_record(user_id));

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update accessible documents" ON documents
  FOR UPDATE
  USING (auth.uid() = user_id OR can_access_record(user_id));

CREATE POLICY "Users can delete own documents or admin" ON documents
  FOR DELETE
  USING (auth.uid() = user_id OR is_admin());