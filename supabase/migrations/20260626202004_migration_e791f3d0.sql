-- =============================================================================
-- REPORTING HIERÁRQUICO: Atualizar funções de estatísticas
-- =============================================================================

-- 1. get_lead_statistics: Filtrar por user_ids visíveis
CREATE OR REPLACE FUNCTION get_lead_statistics(
  start_date timestamptz DEFAULT NULL,
  end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_leads bigint,
  new_leads bigint,
  qualified_leads bigint,
  converted_leads bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
BEGIN
  -- Get visible user IDs based on current user's role
  visible_users := get_visible_user_ids();
  
  RETURN QUERY
  SELECT
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE l.stage = 'new') as new_leads,
    COUNT(*) FILTER (WHERE l.stage = 'qualified') as qualified_leads,
    COUNT(*) FILTER (WHERE l.status = 'won') as converted_leads,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE l.status = 'won')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM leads l
  WHERE 
    l.user_id = ANY(visible_users)
    AND (start_date IS NULL OR l.created_at >= start_date)
    AND (end_date IS NULL OR l.created_at <= end_date);
END;
$$;

-- 2. get_pipeline_overview: Filtrar por user_ids visíveis
CREATE OR REPLACE FUNCTION get_pipeline_overview()
RETURNS TABLE (
  stage text,
  count bigint,
  total_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
BEGIN
  visible_users := get_visible_user_ids();
  
  RETURN QUERY
  SELECT
    l.stage::text,
    COUNT(*) as count,
    COALESCE(SUM((l.estimated_value::numeric * COALESCE((l.probability::numeric / 100), 0))), 0) as total_value
  FROM leads l
  WHERE 
    l.user_id = ANY(visible_users)
    AND l.status NOT IN ('won', 'lost')
  GROUP BY l.stage
  ORDER BY 
    CASE l.stage
      WHEN 'new' THEN 1
      WHEN 'contacted' THEN 2
      WHEN 'qualified' THEN 3
      WHEN 'proposal' THEN 4
      WHEN 'negotiation' THEN 5
      ELSE 6
    END;
END;
$$;

-- 3. get_property_statistics: Filtrar por user_ids visíveis
CREATE OR REPLACE FUNCTION get_property_statistics()
RETURNS TABLE (
  total_properties bigint,
  active_properties bigint,
  sold_properties bigint,
  total_value numeric,
  avg_price numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
BEGIN
  visible_users := get_visible_user_ids();
  
  RETURN QUERY
  SELECT
    COUNT(*) as total_properties,
    COUNT(*) FILTER (WHERE p.status = 'active') as active_properties,
    COUNT(*) FILTER (WHERE p.status = 'sold') as sold_properties,
    COALESCE(SUM(p.price), 0) as total_value,
    COALESCE(AVG(p.price), 0) as avg_price
  FROM properties p
  WHERE p.user_id = ANY(visible_users);
END;
$$;

-- 4. get_task_statistics: Filtrar por user_ids visíveis
CREATE OR REPLACE FUNCTION get_task_statistics()
RETURNS TABLE (
  total_tasks bigint,
  pending_tasks bigint,
  completed_tasks bigint,
  overdue_tasks bigint,
  completion_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
BEGIN
  visible_users := get_visible_user_ids();
  
  RETURN QUERY
  SELECT
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'pending') as pending_tasks,
    COUNT(*) FILTER (WHERE t.status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE t.status = 'pending' AND t.due_date < NOW()) as overdue_tasks,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE t.status = 'completed')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as completion_rate
  FROM tasks t
  WHERE t.user_id = ANY(visible_users);
END;
$$;

-- 5. Atualizar agent_performance view (se existir como view, recriar; se for tabela, não mexer)
DROP VIEW IF EXISTS agent_performance CASCADE;

CREATE OR REPLACE VIEW agent_performance AS
SELECT
  p.id as agent_id,
  p.full_name as agent_name,
  p.email,
  p.role,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as won_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'lost') as lost_leads,
  CASE 
    WHEN COUNT(DISTINCT l.id) > 0 THEN 
      ROUND((COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won')::numeric / COUNT(DISTINCT l.id)::numeric) * 100, 2)
    ELSE 0
  END as win_rate,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
  COUNT(DISTINCT prop.id) as total_properties,
  COALESCE(SUM(l.estimated_value * (l.probability / 100.0)), 0) as pipeline_value
FROM profiles p
LEFT JOIN leads l ON l.user_id = p.id
LEFT JOIN tasks t ON t.user_id = p.id
LEFT JOIN properties prop ON prop.user_id = p.id
GROUP BY p.id, p.full_name, p.email, p.role;

COMMENT ON VIEW agent_performance IS 'Performance metrics by agent - visibility controlled by RLS on underlying tables';

-- 6. Criar função auxiliar para obter lista de users visíveis com detalhes (para dropdowns)
CREATE OR REPLACE FUNCTION get_visible_users_with_details()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role user_role,
  manager_id uuid,
  is_own_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  visible_users uuid[];
  current_user_id uuid;
BEGIN
  visible_users := get_visible_user_ids();
  current_user_id := auth.uid();
  
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.manager_id,
    (p.id = current_user_id) as is_own_record
  FROM profiles p
  WHERE p.id = ANY(visible_users)
  ORDER BY 
    CASE 
      WHEN p.id = current_user_id THEN 0
      ELSE 1
    END,
    p.full_name;
END;
$$;

COMMENT ON FUNCTION get_visible_users_with_details() IS 'Returns detailed list of users visible to current user based on role hierarchy';