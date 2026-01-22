-- Criar extensão pg_cron se não existir
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução da Edge Function meta-leads-sync a cada hora
SELECT cron.schedule(
  'meta-leads-sync-hourly',
  '0 * * * *',  -- A cada hora (minuto 0)
  $$
  SELECT
    net.http_post(
      url := 'https://ykkorjrxomtevcdlyaan.supabase.co/functions/v1/meta-leads-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('source', 'cron')
    ) AS request_id;
  $$
);

-- Criar função helper para verificar status dos cron jobs
CREATE OR REPLACE FUNCTION get_meta_sync_cron_status()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM cron.job
  WHERE jobname = 'meta-leads-sync-hourly';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissões para usuários autenticados verificarem o status
GRANT EXECUTE ON FUNCTION get_meta_sync_cron_status() TO authenticated;