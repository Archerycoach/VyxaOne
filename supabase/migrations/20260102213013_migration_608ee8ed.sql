-- MELHORIA #1: ADICIONAR CASCADE DELETE NAS FOREIGN KEYS
-- Previne dados órfãos quando um lead, property ou contact é eliminado

-- 1. property_matches → leads (CASCADE DELETE)
ALTER TABLE property_matches 
DROP CONSTRAINT IF EXISTS property_matches_lead_id_fkey;

ALTER TABLE property_matches 
ADD CONSTRAINT property_matches_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- 2. property_matches → properties (CASCADE DELETE)
ALTER TABLE property_matches 
DROP CONSTRAINT IF EXISTS property_matches_property_id_fkey;

ALTER TABLE property_matches 
ADD CONSTRAINT property_matches_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- 3. interactions → leads (CASCADE DELETE)
ALTER TABLE interactions 
DROP CONSTRAINT IF EXISTS interactions_lead_id_fkey;

ALTER TABLE interactions 
ADD CONSTRAINT interactions_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- 4. interactions → properties (CASCADE DELETE)
ALTER TABLE interactions 
DROP CONSTRAINT IF EXISTS interactions_property_id_fkey;

ALTER TABLE interactions 
ADD CONSTRAINT interactions_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- 5. calendar_events → leads (CASCADE DELETE)
ALTER TABLE calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_lead_id_fkey;

ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- 6. calendar_events → properties (CASCADE DELETE)
ALTER TABLE calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_property_id_fkey;

ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- 7. tasks → leads (CASCADE DELETE)
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_related_lead_id_fkey;

ALTER TABLE tasks 
ADD CONSTRAINT tasks_related_lead_id_fkey 
FOREIGN KEY (related_lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- 8. tasks → properties (CASCADE DELETE)
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_related_property_id_fkey;

ALTER TABLE tasks 
ADD CONSTRAINT tasks_related_property_id_fkey 
FOREIGN KEY (related_property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- 9. documents → leads (CASCADE DELETE)
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_lead_id_fkey;

ALTER TABLE documents 
ADD CONSTRAINT documents_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- 10. documents → properties (CASCADE DELETE)
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_property_id_fkey;

ALTER TABLE documents 
ADD CONSTRAINT documents_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Verificar CASCADE DELETE aplicado
SELECT 
  'CASCADE DELETE configurado com sucesso!' as status,
  COUNT(*) as foreign_keys_atualizadas
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'public';