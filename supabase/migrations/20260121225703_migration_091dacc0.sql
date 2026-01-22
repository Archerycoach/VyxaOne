-- ============================================
-- CONFIGURAÇÃO DE CRON JOB PARA SINCRONIZAÇÃO META
-- ============================================
-- Este script configura um cron job que sincroniza automaticamente
-- leads dos formulários Meta (Facebook/Instagram) a cada 30 minutos

-- 1. Garantir que pg_cron está instalado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar função que invoca a Edge Function via pg_net
CREATE OR REPLACE FUNCTION invoke_meta_leads_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  supabase_anon_key TEXT;
  response_status INT;
BEGIN
  -- Obter URL do Supabase (ajuste conforme necessário)
  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL THEN
    supabase_url := 'https://ykkorjrxomtevcdlyaan.supabase.co';
  END IF;

  -- Obter anon key (ajuste conforme necessário)
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF supabase_anon_key IS NULL THEN
    -- Usar um placeholder - em produção deve ser a chave real
    supabase_anon_key := 'placeholder_key';
  END IF;

  -- Invocar a Edge Function usando pg_net (nativo do Supabase)
  SELECT status INTO response_status
  FROM net.http_post(
    url := supabase_url || '/functions/v1/meta-leads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key,
      'x-cron-signature', 'internal-cron-job'
    ),
    body := '{}'::jsonb
  );

  -- Log do resultado
  IF response_status = 200 THEN
    RAISE NOTICE 'Meta leads sync executado com sucesso';
  ELSE
    RAISE WARNING 'Meta leads sync falhou com status: %', response_status;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao invocar meta-leads-sync: %', SQLERRM;
END;
$$;

-- 3. Agendar cron job para executar a cada 30 minutos
-- Primeiro remover jobs antigos se existirem
DO $$
BEGIN
  -- Tentar remover jobs antigos (ignorar erros se não existirem)
  BEGIN
    PERFORM cron.unschedule('meta-leads-sync-30min');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar erro se não existir
  END;
  
  BEGIN
    PERFORM cron.unschedule('meta-leads-sync-hourly');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar erro se não existir
  END;
END $$;

-- Criar novo cron job - A CADA 30 MINUTOS
SELECT cron.schedule(
  'meta-leads-sync-30min',
  '*/30 * * * *',  -- A cada 30 minutos
  $$SELECT invoke_meta_leads_sync()$$
);

-- 4. Criar função para verificar status do cron job
CREATE OR REPLACE FUNCTION get_meta_sync_cron_info()
RETURNS TABLE(
  job_name TEXT,
  schedule TEXT,
  active BOOLEAN,
  jobid BIGINT,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    jobname::TEXT,
    schedule::TEXT,
    active,
    jobid,
    (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = cron.job.jobid) as last_run,
    -- Calcular próxima execução baseada no schedule
    CASE 
      WHEN schedule = '*/30 * * * *' THEN 
        NOW() + INTERVAL '30 minutes' - (EXTRACT(MINUTE FROM NOW())::INT % 30) * INTERVAL '1 minute'
      WHEN schedule = '0 * * * *' THEN 
        DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour'
      ELSE NOW() + INTERVAL '1 hour'
    END as next_run
  FROM cron.job
  WHERE jobname LIKE 'meta-leads-sync%'
  ORDER BY jobid DESC
  LIMIT 1;
$$;

-- 5. Permitir que usuários autenticados vejam o status
GRANT EXECUTE ON FUNCTION get_meta_sync_cron_info() TO authenticated;

-- 6. Criar função para testar a sincronização manualmente
CREATE OR REPLACE FUNCTION test_meta_sync()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM invoke_meta_leads_sync();
  RETURN 'Sincronização manual iniciada. Verifique os logs da Edge Function.';
END;
$$;

GRANT EXECUTE ON FUNCTION test_meta_sync() TO authenticated;

-- 7. Mostrar status atual do cron job
SELECT * FROM get_meta_sync_cron_info();