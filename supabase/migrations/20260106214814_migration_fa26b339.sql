-- Adicionar função para calcular lead score automaticamente
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id uuid)
RETURNS integer AS $$
DECLARE
    score integer := 0;
    lead_record record;
    interaction_count integer;
    days_since_contact integer;
BEGIN
    -- Buscar dados do lead
    SELECT * INTO lead_record FROM leads WHERE id = lead_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Score base por tipo de lead
    IF lead_record.lead_type = 'buyer' THEN
        score := score + 10;
    ELSIF lead_record.lead_type = 'seller' THEN
        score := score + 15;
    END IF;
    
    -- Score por orçamento definido
    IF lead_record.budget IS NOT NULL AND lead_record.budget > 0 THEN
        score := score + 20;
    END IF;
    
    -- Score por preferências definidas
    IF lead_record.location_preference IS NOT NULL THEN
        score := score + 10;
    END IF;
    
    IF lead_record.property_type IS NOT NULL THEN
        score := score + 10;
    END IF;
    
    -- Score por interações
    SELECT COUNT(*) INTO interaction_count
    FROM interactions
    WHERE interactions.lead_id = lead_record.id
    AND interaction_date > NOW() - INTERVAL '30 days';
    
    score := score + LEAST(interaction_count * 5, 30);
    
    -- Penalizar por falta de contacto recente
    IF lead_record.last_contact_date IS NOT NULL THEN
        days_since_contact := EXTRACT(DAY FROM NOW() - lead_record.last_contact_date);
        IF days_since_contact > 30 THEN
            score := score - 20;
        ELSIF days_since_contact > 14 THEN
            score := score - 10;
        END IF;
    END IF;
    
    -- Garantir que score está entre 0 e 100
    score := GREATEST(0, LEAST(100, score));
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar score automaticamente
CREATE OR REPLACE FUNCTION update_lead_score_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.score := calculate_lead_score(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_update_lead_score ON leads;
CREATE TRIGGER auto_update_lead_score
    BEFORE INSERT OR UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_score_trigger();