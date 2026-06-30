-- =============================================================================
-- PASSO 4: VERIFICAR TABELAS DE SEGREDOS/CREDENCIAIS/FATURAÇÃO
-- (Mantém auth.uid() = user_id - já estão corretas, só confirmar)
-- =============================================================================

-- Verificar que estas tabelas mantêm políticas estritamente individuais:
-- subscriptions, gpt_api_keys, ai_usage_logs, whatsapp_numbers, payment_transactions

-- 4.1: SUBSCRIPTIONS - confirmar que mantém individual
DO $$
BEGIN
  -- Dropar policies antigas se existirem
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions';
  
  -- Recriar com auth.uid() estrito (NÃO usar can_access_record aqui)
  EXECUTE 'CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (auth.uid() = user_id)';
END $$;

-- 4.2: GPT_API_KEYS - verificar se existe e manter individual
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gpt_api_keys') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own api keys" ON gpt_api_keys';
    EXECUTE 'CREATE POLICY "Users can manage own api keys" ON gpt_api_keys FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

-- 4.3: AI_USAGE_LOGS - manter individual
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_usage_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own usage logs" ON ai_usage_logs';
    EXECUTE 'CREATE POLICY "Users can view own usage logs" ON ai_usage_logs FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

-- 4.4: WHATSAPP_NUMBERS - manter individual
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_numbers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own whatsapp numbers" ON whatsapp_numbers';
    EXECUTE 'CREATE POLICY "Users can manage own whatsapp numbers" ON whatsapp_numbers FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

-- 4.5: PAYMENT_TRANSACTIONS - manter individual
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_transactions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own transactions" ON payment_transactions';
    EXECUTE 'CREATE POLICY "Users can view own transactions" ON payment_transactions FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;