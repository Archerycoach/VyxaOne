# Configurar Sincronização Automática Diária da Meta

Este guia explica como ativar a sincronização automática diária de leads da Meta como backup da captura em tempo real via webhooks.

## ⚡ Visão Geral

O sistema de sincronização automática diária funciona como **backup duplo** da captura em tempo real:

- **Webhook em tempo real**: Captura leads instantaneamente quando são submetidas
- **Sincronização diária**: Sincroniza uma vez por dia para garantir que nenhuma lead foi perdida
- **Detecção de duplicados**: O sistema ignora automaticamente leads já capturadas

---

## 📋 Pré-requisitos

1. **Integração Meta configurada** em Admin → Integrações → Meta
2. **Formulários Meta mapeados** com importação automática ativada
3. **Acesso ao Supabase Dashboard** do projeto

---

## 🚀 Passo 1: Ativar na Interface

1. Aceda a **Admin** → **Integrações** → **Meta**
2. Clique na integração da página Meta desejada
3. Encontre o card verde **"Sincronização Automática Diária"**
4. Ative o toggle **"Ativar sincronização automática diária"**
5. Selecione a **hora** em que deseja executar a sincronização (recomendado: 6h UTC = 6h GMT)
6. Clique em **"Guardar"**

✅ A integração está agora configurada para sincronização automática!

---

## ⚙️ Passo 2: Configurar Cron Job no Supabase

### 2.1 Aceder ao Supabase Dashboard

1. Aceda a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione o seu projeto
3. No menu lateral, clique em **Database** → **Extensions**

### 2.2 Ativar a extensão pg_cron

1. Procure por **pg_cron** na lista de extensões
2. Se não estiver ativada, clique em **Enable** ao lado de pg_cron
3. Aguarde alguns segundos até a extensão ficar ativa

### 2.3 Criar o Cron Job

1. No menu lateral, clique em **Database** → **SQL Editor**
2. Clique em **+ New query**
3. Cole o seguinte código SQL:

```sql
-- Criar cron job para sincronizar leads da Meta diariamente às 6h UTC
SELECT cron.schedule(
  'meta-daily-sync',              -- Nome do job
  '0 6 * * *',                    -- Cron expression (6h UTC todos os dias)
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/meta-leads-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

4. **IMPORTANTE**: Substitua no código acima:
   - `YOUR_PROJECT_REF` → O REF do seu projeto Supabase (exemplo: `abcdefghijklmn`)
   - `YOUR_SERVICE_ROLE_KEY` → A service role key do seu projeto (Settings → API → service_role key)

5. **Ajuste a hora se necessário**:
   - `'0 6 * * *'` = 6h UTC todos os dias
   - `'0 3 * * *'` = 3h UTC todos os dias
   - `'0 12 * * *'` = 12h UTC todos os dias
   - Use [crontab.guru](https://crontab.guru/) para testar expressões cron

6. Clique em **Run** para criar o cron job

### 2.4 Verificar se o Cron Job foi criado

Execute esta query no SQL Editor para listar todos os cron jobs:

```sql
SELECT * FROM cron.job;
```

Deve ver o job **meta-daily-sync** na lista.

---

## 🔍 Passo 3: Testar Manualmente

Para testar se a Edge Function está a funcionar corretamente antes de aguardar pelo cron:

### Opção A: Via curl (Terminal)

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/meta-leads-sync' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

### Opção B: Via Supabase Dashboard

1. Aceda a **Edge Functions** no menu lateral
2. Clique em **meta-leads-sync**
3. Clique em **Invoke Function**
4. A resposta deve mostrar quantas leads foram sincronizadas

---

## 📊 Monitorizar Execuções

### Ver logs do Cron Job

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'meta-daily-sync')
ORDER BY start_time DESC
LIMIT 10;
```

### Ver logs da Edge Function

1. No Supabase Dashboard, aceda a **Edge Functions** → **meta-leads-sync**
2. Clique na tab **Logs**
3. Verá todas as execuções recentes e mensagens de log

---

## 🔧 Configurações Avançadas

### Alterar a frequência

Para sincronizar **2x por dia** (6h e 18h):

```sql
-- Apagar o job existente
SELECT cron.unschedule('meta-daily-sync');

-- Criar dois jobs separados
SELECT cron.schedule('meta-sync-morning', '0 6 * * *', $$ [MESMO CÓDIGO] $$);
SELECT cron.schedule('meta-sync-evening', '0 18 * * *', $$ [MESMO CÓDIGO] $$);
```

### Sincronizar apenas dias úteis

Para executar apenas de segunda a sexta:

```sql
'0 6 * * 1-5'  -- 6h UTC, segunda a sexta
```

### Desativar temporariamente

```sql
-- Desativar
SELECT cron.unschedule('meta-daily-sync');

-- Reativar (executar novamente o código de criação do job)
```

---

## 🚨 Troubleshooting

### O cron job não está a executar

1. **Verifique se a extensão pg_cron está ativa**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Verifique se o job existe**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'meta-daily-sync';
   ```

3. **Verifique os logs de erro**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC;
   ```

### As leads não estão a sincronizar

1. **Verifique se `auto_daily_sync` está ativado** na integração Meta
2. **Teste manualmente** a Edge Function (ver Passo 3)
3. **Verifique os logs** da Edge Function no Dashboard
4. **Confirme que os formulários** têm `auto_import: true`

### Leads duplicadas

O sistema **não cria duplicados**. Deteta leads por:
1. `meta_lead_id` (ID único da Meta)
2. Email da lead
3. Telefone da lead

Se uma lead já existe, adiciona uma **nota** ao perfil existente em vez de criar duplicado.

---

## 📝 Notas Importantes

- **Timezone**: O cron usa UTC. Portugal = UTC+0 no inverno, UTC+1 no verão.
- **Service Role Key**: É uma chave secreta - nunca a exponha publicamente.
- **Limites**: A Edge Function sincroniza leads das últimas 24 horas em cada execução.
- **Custo**: Edge Functions têm limites gratuitos generosos no Supabase - verifique o seu plano.

---

## ✅ Verificação Final

Execute este checklist para confirmar que tudo está configurado:

- [ ] Extensão `pg_cron` ativada no Supabase
- [ ] Cron job `meta-daily-sync` criado e visível em `cron.job`
- [ ] Toggle "Sincronização automática diária" ativado na interface
- [ ] Hora configurada adequadamente
- [ ] Teste manual executado com sucesso
- [ ] Logs da Edge Function mostram execução sem erros

---

## 📚 Recursos Adicionais

- [Documentação pg_cron](https://github.com/citusdata/pg_cron)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Crontab Guru - Testar expressões cron](https://crontab.guru/)

---

**Precisa de ajuda?** Contacte o suporte técnico com os logs da Edge Function e detalhes da configuração.