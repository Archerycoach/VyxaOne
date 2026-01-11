# Como Ativar Cron Jobs no Supabase

## 📋 Pré-requisitos
- Projeto Supabase criado
- Edge Function `google-calendar-auto-sync` já criada
- Acesso ao Dashboard do Supabase

## 🔧 Método 1: Dashboard do Supabase (Recomendado)

### Passo 1: Acessar Cron Jobs
1. Aceda ao [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione o seu projeto
3. No menu lateral, vá para **Database** → **Cron Jobs**

### Passo 2: Criar Novo Cron Job
1. Clique em **Create a new cron job**
2. Preencha os campos:
   - **Name**: `google-calendar-hourly-sync`
   - **Schedule**: `0 * * * *` (a cada hora)
   - **SQL Query**:
   ```sql
   SELECT
     net.http_post(
       url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-calendar-auto-sync',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id;
   ```

### Passo 3: Substituir Variáveis
Substitua:
- `YOUR_PROJECT_REF` pelo Reference ID do seu projeto (encontrado em Settings → General)
- `YOUR_ANON_KEY` pela sua Anon Key (encontrado em Settings → API)

### Passo 4: Ativar
1. Clique em **Save**
2. Certifique-se de que o cron job está **Enabled**

## 🔧 Método 2: SQL Editor

### Passo 1: Habilitar pg_cron
```sql
-- Verificar se pg_cron está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se não estiver, habilitar (requer permissões de superuser - contactar Supabase Support)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Passo 2: Criar Cron Job
```sql
SELECT cron.schedule(
  'google-calendar-hourly-sync',
  '0 * * * *', -- A cada hora
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-calendar-auto-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### Passo 3: Verificar Cron Jobs Ativos
```sql
SELECT * FROM cron.job;
```

## 🔧 Método 3: Supabase CLI (Avançado)

### Passo 1: Instalar Supabase CLI
```bash
npm install -g supabase
```

### Passo 2: Login e Link do Projeto
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Passo 3: Criar Ficheiro de Migração
Crie `supabase/migrations/YYYYMMDDHHMMSS_setup_google_calendar_cron.sql`:
```sql
SELECT cron.schedule(
  'google-calendar-hourly-sync',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-calendar-auto-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### Passo 4: Aplicar Migração
```bash
supabase db push
```

## 📊 Verificar Funcionamento

### Ver Logs da Edge Function
1. Vá para **Edge Functions** no Dashboard
2. Selecione `google-calendar-auto-sync`
3. Clique em **Logs** para ver execuções

### Testar Manualmente
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-calendar-auto-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Ver Histórico de Execuções do Cron
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'google-calendar-hourly-sync')
ORDER BY start_time DESC 
LIMIT 10;
```

## 🔄 Gestão de Cron Jobs

### Pausar Cron Job
```sql
SELECT cron.unschedule('google-calendar-hourly-sync');
```

### Alterar Frequência
```sql
-- Remover existente
SELECT cron.unschedule('google-calendar-hourly-sync');

-- Criar com nova frequência (exemplo: a cada 30 minutos)
SELECT cron.schedule(
  'google-calendar-hourly-sync',
  '*/30 * * * *', -- A cada 30 minutos
  $$ ... $$
);
```

### Eliminar Cron Job
```sql
SELECT cron.unschedule('google-calendar-hourly-sync');
```

## 📝 Exemplos de Horários Cron

```
0 * * * *      - A cada hora (no minuto 0)
*/30 * * * *   - A cada 30 minutos
0 */2 * * *    - A cada 2 horas
0 9 * * *      - Todos os dias às 9h
0 9 * * 1      - Todas as segundas-feiras às 9h
*/15 9-17 * * 1-5 - A cada 15 min, das 9h às 17h, seg-sex
```

## ⚠️ Notas Importantes

1. **Edge Functions**: Certifique-se de que a Edge Function `google-calendar-auto-sync` está criada e funcional
2. **Permissões**: A Anon Key tem permissões para chamar Edge Functions
3. **Custos**: Verifique os limites do seu plano Supabase para execuções de Cron Jobs
4. **Timeout**: Edge Functions têm timeout de 150 segundos no plano gratuito
5. **Logs**: Monitore os logs regularmente para identificar erros

## 🆘 Resolução de Problemas

### Cron Job não está a executar
1. Verifique se `pg_cron` está habilitado
2. Confirme que o URL da Edge Function está correto
3. Verifique se a Anon Key está correta
4. Veja os logs do cron: `SELECT * FROM cron.job_run_details`

### Edge Function retorna erro
1. Verifique os logs da Edge Function no Dashboard
2. Teste a função manualmente via curl
3. Confirme que as credenciais OAuth estão configuradas

### Sincronização não acontece
1. Verifique se há integrações com `auto_sync = true`
2. Confirme que os tokens não expiraram
3. Veja os logs da Edge Function para detalhes

## 📚 Recursos Adicionais

- [Documentação Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Documentação Edge Functions](https://supabase.com/docs/guides/functions)
- [Cron Expression Generator](https://crontab.guru/)