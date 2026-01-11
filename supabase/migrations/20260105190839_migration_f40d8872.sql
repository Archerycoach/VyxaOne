-- ============================================
-- PREVENIR DUPLICAÇÃO DE EVENTOS
-- Adicionar constraint de unicidade para google_event_id
-- ============================================

-- 1. Primeiro, limpar duplicados existentes (manter o mais recente)
WITH duplicates AS (
  SELECT 
    id,
    google_event_id,
    user_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, google_event_id 
      ORDER BY created_at DESC
    ) as rn
  FROM calendar_events
  WHERE google_event_id IS NOT NULL
)
DELETE FROM calendar_events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Adicionar constraint de unicidade
ALTER TABLE calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_google_event_id_user_id_key;

ALTER TABLE calendar_events
ADD CONSTRAINT calendar_events_google_event_id_user_id_key 
UNIQUE (user_id, google_event_id);

-- Verificar constraint criada
SELECT 
  constraint_name,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'calendar_events' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%google_event_id%';