# 🔧 Setup do Cron Job - Google Calendar Auto-Sync

## ❌ Problema Identificado

O cron job `google-calendar-hourly-sync` está a falhar porque a Edge Function `google-calendar-auto-sync` não foi deployada no Supabase.

**Status atual:**
- ✅ Cron job criado e enabled
- ✅ Função criada localmente em `supabase/functions/google-calendar-auto-sync/`
- ❌ Função **NÃO deployada** no Supabase

## 🚀 Solução: Deploy da Edge Function

### Método 1: Deploy via Supabase CLI (Recomendado)

#### Passo 1: Instalar Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Ou via NPM (qualquer sistema)
npm install -g supabase
```

#### Passo 2: Login no Supabase

```bash
supabase login
```

Isto abrirá o browser para autorizar o CLI.

#### Passo 3: Link do projeto

```bash
# Obter o Project ID do dashboard: Settings > General > Reference ID
supabase link --project-ref SEU_PROJECT_REF
```

#### Passo 4: Deploy da função

```bash
# Na raiz do projeto
supabase functions deploy google-calendar-auto-sync
```

#### Passo 5: Configurar Secrets

```bash
# Definir as variáveis de ambiente necessárias
supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

**⚠️ IMPORTANTE**: Obtenha a `SUPABASE_SERVICE_ROLE_KEY` em:
Dashboard > Settings > API > `service_role` key (secret)

#### Passo 6: Testar a função

```bash
# Testar localmente primeiro
supabase functions serve google-calendar-auto-sync

# Testar a função deployada
curl -X POST \
  'https://seu-projeto.supabase.co/functions/v1/google-calendar-auto-sync' \
  -H 'Authorization: Bearer SUA_ANON_KEY' \
  -H 'Content-Type: application/json'
```

---

### Método 2: Deploy via Dashboard do Supabase

#### Passo 1: Aceder ao Dashboard

1. Vá para [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione o seu projeto
3. Vá para **Edge Functions** no menu lateral

#### Passo 2: Criar nova função

1. Clique em **"Create a new function"**
2. Nome: `google-calendar-auto-sync`
3. Copie o código de `supabase/functions/google-calendar-auto-sync/index.ts`
4. Cole no editor
5. Clique **Deploy**

#### Passo 3: Configurar Secrets

1. No Dashboard, vá para **Edge Functions** > **Secrets**
2. Adicione:
   - `SUPABASE_URL` = `https://seu-projeto.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = [obtida em Settings > API]

#### Passo 4: Testar

1. Na página da função, clique em **"Invoke"**
2. Deixe o body vazio `{}`
3. Clique **Send**
4. Verifique a resposta

---

## ✅ Verificação Final

Após o deploy, verifique se tudo está a funcionar:

### 1. Verificar se a função está deployada

```bash
supabase functions list
```

Deve aparecer `google-calendar-auto-sync` na lista.

### 2. Testar o cron job manualmente

Execute este SQL no Supabase SQL Editor:

```sql
-- Executar o cron job manualmente
SELECT cron.schedule(
  'test-google-calendar-sync',
  '* * * * *',  -- Executar agora (cada minuto)
  $$
  SELECT
    net.http_post(
      url:=concat(
        current_setting('app.settings.supabase_url', true),
        '/functions/v1/google-calendar-auto-sync'
      ),
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Aguardar 1 minuto e verificar logs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'test-google-calendar-sync')
ORDER BY start_time DESC 
LIMIT 5;

-- Remover o job de teste
SELECT cron.unschedule('test-google-calendar-sync');
```

### 3. Verificar logs do cron job principal

```sql
-- Ver últimas 10 execuções
SELECT 
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  jrd.return_message
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'google-calendar-hourly-sync'
ORDER BY jrd.start_time DESC
LIMIT 10;
```

### 4. Verificar logs da Edge Function

No Dashboard do Supabase:
1. Vá para **Edge Functions**
2. Clique em `google-calendar-auto-sync`
3. Vá para o tab **Logs**
4. Verifique se há erros

---

## 🔍 Troubleshooting

### Erro: "Function not found"

**Causa**: A função não foi deployada corretamente.

**Solução**: 
1. Verifique se a função aparece em `supabase functions list`
2. Tente fazer deploy novamente
3. Verifique se está no diretório correto do projeto

### Erro: "Invalid credentials" ou "Unauthorized"

**Causa**: Secrets não configurados ou incorretos.

**Solução**:
1. Verifique se `SUPABASE_SERVICE_ROLE_KEY` está correta
2. Verifique se `SUPABASE_URL` está correto
3. Re-configure os secrets: `supabase secrets set KEY=VALUE`

### Erro: "Network error" ou "Connection timeout"

**Causa**: URL incorreta ou função não acessível.

**Solução**:
1. Verifique se a URL no cron job está correta
2. Teste a função manualmente via curl
3. Verifique se a função está deployed e active

### Cron job executa mas não sincroniza

**Causa**: Possíveis erros na lógica da função.

**Solução**:
1. Verifique os logs da Edge Function
2. Verifique se existem integrações com `auto_sync = true`:
```sql
SELECT * FROM google_calendar_integrations WHERE auto_sync = true;
```
3. Teste a função manualmente para ver a resposta

---

## 🔧 Otimizações Implementadas

### Gestão de Memória
A Edge Function foi otimizada para reduzir o uso de memória:

✅ **Processamento em Batches**: Processa apenas 5 utilizadores de cada vez
✅ **Limites de Eventos**: Máximo de 50 eventos/tarefas por sincronização
✅ **Timeout de 30 segundos**: Previne execuções longas
✅ **Processamento Sequencial**: Um utilizador de cada vez (não paralelo)
✅ **Queries Otimizadas**: Apenas campos necessários são carregados

### Se continuar a ter erros "Out of Memory":

1. **Reduzir BATCH_SIZE**:
   - Abra `supabase/functions/google-calendar-auto-sync/index.ts`
   - Altere `const BATCH_SIZE = 5;` para `const BATCH_SIZE = 3;` ou `2`

2. **Reduzir MAX_EVENTS_PER_SYNC**:
   - Altere `const MAX_EVENTS_PER_SYNC = 50;` para `25` ou `10`

3. **Aumentar frequência do Cron**:
   - Em vez de `0 * * * *` (cada hora), use `*/30 * * * *` (cada 30 min)
   - Processa menos dados por execução

4. **Verificar utilizadores ativos**:
```sql
-- Ver quantos utilizadores têm auto_sync ativo
SELECT COUNT(*) FROM google_calendar_integrations WHERE auto_sync = true;

-- Se forem muitos (>20), considere desativar auto_sync para utilizadores inativos
UPDATE google_calendar_integrations 
SET auto_sync = false 
WHERE last_sync_at < NOW() - INTERVAL '30 days';
```

---

## 📊 Monitorização

### Query para monitorizar sincronizações

```sql
-- Ver últimas sincronizações por utilizador
SELECT 
  u.email,
  gci.google_email,
  gci.last_sync_at,
  gci.auto_sync,
  gci.sync_direction
FROM google_calendar_integrations gci
JOIN auth.users u ON u.id = gci.user_id
WHERE gci.auto_sync = true
ORDER BY gci.last_sync_at DESC;
```

### Query para ver performance do cron job

```sql
-- Estatísticas das últimas 24 horas
SELECT 
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'google-calendar-hourly-sync')
  AND start_time > NOW() - INTERVAL '24 hours';
```

---

## 📚 Recursos Adicionais

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/introduction)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [Cron Expression Generator](https://crontab.guru/)

---

## 🎯 Checklist Final

Antes de considerar o setup completo, verifique:

- [ ] Supabase CLI instalado
- [ ] Projeto linkado com `supabase link`
- [ ] Edge Function deployada com `supabase functions deploy`
- [ ] Secrets configurados (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
- [ ] Função testada manualmente e retorna sucesso
- [ ] Cron job enabled no Dashboard
- [ ] Cron job executou com sucesso pelo menos uma vez
- [ ] Logs da Edge Function não mostram erros
- [ ] `last_sync_at` está a ser atualizado na tabela `google_calendar_integrations`

Uma vez completada esta checklist, o sistema estará a funcionar automaticamente! 🎉