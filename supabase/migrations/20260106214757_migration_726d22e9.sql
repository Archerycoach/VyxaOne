-- Adicionar índices compostos para melhorar performance em queries frequentes

-- Índices para dashboard de leads por status e data
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_status_created ON leads(user_id, status, created_at DESC);

-- Índices para filtros de propriedades
CREATE INDEX IF NOT EXISTS idx_properties_type_status_price ON properties(property_type, status, price);
CREATE INDEX IF NOT EXISTS idx_properties_city_type_status ON properties(city, property_type, status);

-- Índices para calendar events por user e data
CREATE INDEX IF NOT EXISTS idx_calendar_user_start_end ON calendar_events(user_id, start_time, end_time);

-- Índices para tasks pendentes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due ON tasks(assigned_to, status, due_date);

-- Índices para notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);

-- Índices para interactions por lead e data
CREATE INDEX IF NOT EXISTS idx_interactions_lead_date_desc ON interactions(lead_id, interaction_date DESC);

-- Índices para property_matches por score
CREATE INDEX IF NOT EXISTS idx_property_matches_lead_score ON property_matches(lead_id, match_score DESC);