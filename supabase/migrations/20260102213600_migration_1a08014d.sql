-- MELHORIA #2: CRIAR ÍNDICES COMPOSTOS OTIMIZADOS (VERSÃO CORRIGIDA - FINAL)
-- Corrigindo nome de coluna documents.created_at em vez de uploaded_at

-- 1. Leads por status + agente (usado em dashboard)
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned_to 
ON leads(status, assigned_to);

-- 2. Propriedades por tipo + cidade + status (usado em pesquisas)
CREATE INDEX IF NOT EXISTS idx_properties_type_city_status 
ON properties(property_type, city, status);

-- 3. Property matches ordenados por score (ordenação por relevância)
CREATE INDEX IF NOT EXISTS idx_property_matches_score_desc 
ON property_matches(lead_id, match_score DESC);

-- 4. Tasks pendentes por utilizador + data (dashboard de tarefas)
CREATE INDEX IF NOT EXISTS idx_tasks_pending_user_date 
ON tasks(user_id, status, due_date);

-- 5. Notificações não lidas por utilizador + data (centro de notificações)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user_created 
ON notifications(user_id, created_at DESC);

-- 6. Calendar events por utilizador + data (calendário)
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date 
ON calendar_events(user_id, start_time);

-- 7. Interactions recentes por lead (timeline de interações)
CREATE INDEX IF NOT EXISTS idx_interactions_lead_date 
ON interactions(lead_id, interaction_date DESC);

-- 8. Documents por lead/property (listagem de documentos)
CREATE INDEX IF NOT EXISTS idx_documents_lead_property 
ON documents(lead_id, property_id, created_at DESC);

-- 9. Subscriptions ativas por utilizador (verificação de acesso)
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_user 
ON subscriptions(user_id, status);

-- 10. Payment history por subscription (histórico de pagamentos)
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_date 
ON payment_history(subscription_id, payment_date DESC);

-- Verificar índices criados
SELECT 
  'Índices compostos criados com sucesso!' as status,
  COUNT(*) as total_indices
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';