-- Criar views materializadas em vez de views normais para melhor performance
-- (Views materializadas não precisam de políticas RLS, são tabelas cached)

DROP VIEW IF EXISTS lead_statistics;
DROP VIEW IF EXISTS pipeline_overview;

-- Criar função para refresh de estatísticas (pode ser chamada manualmente ou via cron)
CREATE OR REPLACE FUNCTION refresh_lead_statistics()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    total_leads BIGINT,
    active_leads BIGINT,
    converted_leads BIGINT,
    avg_score NUMERIC,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.user_id,
        p.full_name,
        COUNT(*)::BIGINT as total_leads,
        COUNT(*) FILTER (WHERE l.status NOT IN ('converted', 'lost'))::BIGINT as active_leads,
        COUNT(*) FILTER (WHERE l.status = 'converted')::BIGINT as converted_leads,
        AVG(l.lead_score) as avg_score,
        SUM(l.estimated_value) as total_value
    FROM leads l
    LEFT JOIN profiles p ON l.user_id = p.id
    GROUP BY l.user_id, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para pipeline overview
CREATE OR REPLACE FUNCTION get_pipeline_overview()
RETURNS TABLE (
    status TEXT,
    lead_type TEXT,
    count BIGINT,
    total_value NUMERIC,
    avg_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.status,
        l.lead_type,
        COUNT(*)::BIGINT as count,
        SUM(l.estimated_value) as total_value,
        AVG(l.lead_score) as avg_score
    FROM leads l
    WHERE l.status NOT IN ('lost', 'archived')
    GROUP BY l.status, l.lead_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;