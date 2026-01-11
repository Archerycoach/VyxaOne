-- Adicionar função para validar e normalizar dados de leads
CREATE OR REPLACE FUNCTION validate_lead_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalizar email para lowercase
    IF NEW.email IS NOT NULL THEN
        NEW.email := LOWER(TRIM(NEW.email));
    END IF;
    
    -- Normalizar phone (remover espaços e caracteres especiais)
    IF NEW.phone IS NOT NULL THEN
        NEW.phone := REGEXP_REPLACE(NEW.phone, '[^0-9+]', '', 'g');
    END IF;
    
    -- Garantir que probability está entre 0 e 100
    IF NEW.probability IS NOT NULL THEN
        NEW.probability := GREATEST(0, LEAST(100, NEW.probability));
    END IF;
    
    -- Auto-atribuir temperatura baseada em probability se não definida
    IF NEW.temperature IS NULL AND NEW.probability IS NOT NULL THEN
        IF NEW.probability >= 70 THEN
            NEW.temperature := 'hot';
        ELSIF NEW.probability >= 40 THEN
            NEW.temperature := 'warm';
        ELSE
            NEW.temperature := 'cold';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
DROP TRIGGER IF EXISTS validate_lead_data_trigger ON leads;
CREATE TRIGGER validate_lead_data_trigger
    BEFORE INSERT OR UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION validate_lead_data();