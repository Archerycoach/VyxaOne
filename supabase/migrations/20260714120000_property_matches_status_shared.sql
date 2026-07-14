-- A constraint antiga só permitia status IN ('pending','viewed','interested',
-- 'rejected'), o que fazia falhar a adição de imóveis ao Portal do Cliente
-- (status "shared") e o auto-match. Alargamos o conjunto permitido, incluindo
-- também "new" (o default histórico de algumas migrações) e "shared".
ALTER TABLE property_matches DROP CONSTRAINT IF EXISTS property_matches_status_check;

ALTER TABLE property_matches
  ADD CONSTRAINT property_matches_status_check
  CHECK (status IN ('new', 'pending', 'viewed', 'interested', 'rejected', 'shared'));
