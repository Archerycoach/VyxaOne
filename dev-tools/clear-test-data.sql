-- =====================================================
-- SCRIPT DE LIMPEZA DE DADOS DE TESTE
-- =====================================================
-- ⚠️ ATENÇÃO: Este script REMOVE TODOS OS DADOS!
-- USE APENAS EM AMBIENTE DE TESTES!
--
-- Para executar:
-- 1. Certifique-se 100% de que está no projeto de TESTES
-- 2. Execute no SQL Editor do Supabase
-- 3. Ou use: npm run db:clear:testing
-- =====================================================

-- Confirmar ambiente
DO $$
BEGIN
  -- Se o projeto_ref não for o de testes, PARAR
  IF current_database() != 'postgres' THEN
    RAISE EXCEPTION 'Este script só deve ser executado em ambiente de TESTES!';
  END IF;
END $$;

-- =====================================================
-- LIMPEZA DE DADOS (CASCADE remove dados relacionados)
-- =====================================================

-- Desabilitar temporariamente checagem de chaves estrangeiras
SET session_replication_role = 'replica';

-- Limpar dados de todas as tabelas
TRUNCATE TABLE workflow_executions CASCADE;
TRUNCATE TABLE workflows CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE interactions CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE calendar_events CASCADE;
TRUNCATE TABLE financing_applications CASCADE;
TRUNCATE TABLE property_matches CASCADE;
TRUNCATE TABLE properties CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE settings CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- Reabilitar checagem de chaves estrangeiras
SET session_replication_role = 'origin';

-- =====================================================
-- RESETAR SEQUÊNCIAS (se existirem)
-- =====================================================

-- Esta parte garante que IDs auto-incrementais começam do 1 novamente
-- (Não aplicável se usar apenas UUIDs, mas incluído por completude)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE IF EXISTS ' || quote_ident(r.tablename) || '_id_seq RESTART WITH 1';
    END LOOP;
END $$;

-- =====================================================
-- CONFIRMAR LIMPEZA
-- =====================================================

SELECT 'Base de dados limpa com sucesso!' as status,
       (SELECT COUNT(*) FROM profiles) as profiles_remaining,
       (SELECT COUNT(*) FROM contacts) as contacts_remaining,
       (SELECT COUNT(*) FROM leads) as leads_remaining,
       (SELECT COUNT(*) FROM properties) as properties_remaining,
       (SELECT COUNT(*) FROM interactions) as interactions_remaining,
       (SELECT COUNT(*) FROM tasks) as tasks_remaining;

-- Se todos os counts forem 0, sucesso!