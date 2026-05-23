-- Identificar e remover qualquer restrição UNIQUE na coluna lead_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'properties'::regclass 
        AND contype = 'u' 
        AND pg_get_constraintdef(oid) LIKE '%(lead_id)%'
    ) LOOP
        EXECUTE 'ALTER TABLE properties DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;