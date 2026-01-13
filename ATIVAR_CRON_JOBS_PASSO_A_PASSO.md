# 📅 Como Configurar Emails Diários Automáticos (Cron Jobs)

Este guia explica como ativar e testar a funcionalidade de emails diários automáticos que envia um resumo das tarefas e eventos do dia.

---

## 🧪 PARTE 1: TESTAR MANUALMENTE (Recomendado fazer primeiro)

### **Pré-requisitos:**
- ✅ SMTP configurado em `/settings` → "Configurações SMTP"
- ✅ Notificações ativadas no perfil (`email_daily_tasks` ou `email_daily_events`)
- ✅ Tarefas ou eventos criados para hoje

### **Método 1: Via cURL (Terminal)**

1. **Obtenha suas credenciais Supabase:**
   - Acesse: [Supabase Dashboard](https://supabase.com/dashboard)
   - Selecione seu projeto
   - Vá em **Settings** → **API**
   - Copie:
     - `Project URL` (ex: `https://abc123.supabase.co`)
     - `anon public key` (começa com `eyJ...`)

2. **Execute o comando no terminal:**

```bash
curl -X POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/daily-emails' \
  -H 'Authorization: Bearer SUA_ANON_KEY' \
  -H 'Content-Type: application/json'
```

**Substitua:**
- `SEU_PROJECT_REF` → URL do seu projeto (ex: `abc123.supabase.co`)
- `SUA_ANON_KEY` → Sua chave anon public

**Exemplo real:**
```bash
curl -X POST \
  'https://xyzproject.supabase.co/functions/v1/daily-emails' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

3. **Verifique a resposta:**

✅ **Sucesso:**
```json
{
  "success": 1,
  "failed": 0,
  "skipped": 0,
  "errors": []
}
```

❌ **Erro - Sem SMTP configurado:**
```json
{
  "success": 0,
  "failed": 0,
  "skipped": 1,
  "errors": []
}
```

❌ **Erro - SMTP inválido:**
```json
{
  "success": 0,
  "failed": 1,
  "skipped": 0,
  "errors": ["user@example.com: Invalid login"]
}
```

### **Método 2: Via Postman/Insomnia**

1. Crie uma nova requisição **POST**
2. URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/daily-emails`
3. Headers:
   ```
   Authorization: Bearer SUA_ANON_KEY
   Content-Type: application/json
   ```
4. Clique **Send**
5. Verifique a resposta

### **Método 3: Via Supabase Dashboard**

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Edge Functions** → `daily-emails`
4. Clique no botão **"Invoke"** ou **"Test"**
5. Verifique os **Logs** na mesma página

---

## ⚙️ PARTE 2: CONFIGURAR CRON JOB (Execução Automática)

### **Opção A: Via Supabase Dashboard (SQL Editor)** ⭐ RECOMENDADO

1. **Acesse o SQL Editor:**
   - Vá para [Supabase Dashboard](https://supabase.com/dashboard)
   - Selecione seu projeto
   - Clique em **SQL Editor** (barra lateral esquerda)

2. **Habilite a extensão pg_cron** (se ainda não estiver ativa):

```sql
-- Ativar extensão de cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Clique **"Run"** para executar.

3. **Crie o Cron Job para Emails Diários:**

```sql
-- Agendar emails diários para as 08:00 UTC (09:00 Portugal Continental)
SELECT cron.schedule(
  'daily-emails-morning',                    -- Nome do job
  '0 8 * * *',                              -- Cron expression (todos os dias às 08:00 UTC)
  $$
  SELECT
    net.http_post(
      url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/daily-emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SUA_ANON_KEY',
        'Content-Type', 'application/json'
      )
    ) AS request_id;
  $$
);
```

**⚠️ IMPORTANTE:** Substitua:
- `SEU_PROJECT_REF` → URL do seu projeto
- `SUA_ANON_KEY` → Sua chave anon public

**Exemplo real:**
```sql
SELECT cron.schedule(
  'daily-emails-morning',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://xyzproject.supabase.co/functions/v1/daily-emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'Content-Type', 'application/json'
      )
    ) AS request_id;
  $$
);
```

4. **Clique "Run"** para criar o cron job.

---

### **Horários Sugeridos (Cron Expressions):**

| Horário | Cron Expression | Descrição |
|---------|----------------|-----------|
| 08:00 UTC (09:00 PT) | `0 8 * * *` | Todos os dias às 08:00 |
| 09:00 UTC (10:00 PT) | `0 9 * * *` | Todos os dias às 09:00 |
| 07:00 UTC (08:00 PT) - Dias úteis | `0 7 * * 1-5` | Segunda a Sexta às 07:00 |
| 06:00 UTC (07:00 PT) | `0 6 * * *` | Todos os dias às 06:00 |

**⚠️ Nota:** UTC é o fuso horário de referência. Portugal Continental é UTC+0 (inverno) ou UTC+1 (verão).

---

### **Opção B: Via SQL direto na base de dados**

Se preferir executar SQL diretamente:

```sql
-- 1. Ativar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar o cron job
SELECT cron.schedule(
  'daily-emails-morning',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/daily-emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SUA_ANON_KEY',
        'Content-Type', 'application/json'
      )
    ) AS request_id;
  $$
);
```

---

## 🔍 PARTE 3: VERIFICAR SE ESTÁ FUNCIONANDO

### **1. Listar Cron Jobs Ativos:**

```sql
-- Ver todos os cron jobs configurados
SELECT * FROM cron.job;
```

Deve aparecer uma linha com:
- `jobname`: `daily-emails-morning`
- `schedule`: `0 8 * * *`
- `active`: `t` (true)

### **2. Ver Histórico de Execuções:**

```sql
-- Ver últimas 10 execuções
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

Verifique:
- `status`: Deve ser `succeeded`
- `return_message`: Deve conter a resposta JSON da Edge Function

### **3. Ver Logs da Edge Function:**

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Edge Functions** → `daily-emails`
3. Clique em **Logs**
4. Procure por:
   - ✅ `"🔔 [daily-emails] Starting daily email notifications..."`
   - ✅ `"✅ [daily-emails] Sent to user@example.com"`
   - ❌ `"❌ [daily-emails] Error for user@example.com: ..."`

### **4. Verificar Email Recebido:**

- ✅ Verifique sua caixa de entrada
- ✅ Verifique pasta de SPAM/Lixo eletrônico
- ✅ Email deve ter:
  - Assunto: `📅 Resumo Diário - [Data]`
  - Conteúdo: Tarefas e eventos do dia

---

## 🛠️ PARTE 4: GESTÃO DO CRON JOB

### **Desativar Cron Job:**

```sql
-- Desativar sem apagar
UPDATE cron.job 
SET active = false 
WHERE jobname = 'daily-emails-morning';
```

### **Reativar Cron Job:**

```sql
-- Reativar
UPDATE cron.job 
SET active = true 
WHERE jobname = 'daily-emails-morning';
```

### **Alterar Horário:**

```sql
-- Mudar para 09:00 UTC
UPDATE cron.job 
SET schedule = '0 9 * * *' 
WHERE jobname = 'daily-emails-morning';
```

### **Apagar Cron Job:**

```sql
-- Apagar completamente
SELECT cron.unschedule('daily-emails-morning');
```

---

## 🐛 TROUBLESHOOTING (Resolução de Problemas)

### **Problema 1: "Nenhum email foi enviado"**

**Causa:** Utilizadores sem SMTP configurado ou sem notificações ativadas.

**Solução:**
1. Vá a `/settings`
2. Configure **"Configurações SMTP"**
3. Ative **"Receber resumo diário de tarefas"** e/ou **"Receber resumo diário de eventos"**

### **Problema 2: "Invalid login" ou erro de SMTP**

**Causa:** Credenciais SMTP inválidas.

**Solução:**
1. Vá a `/settings` → "Configurações SMTP"
2. Clique **"Testar conexão"**
3. Corrija as credenciais se necessário

### **Problema 3: "Email não chega"**

**Causa:** Pode estar na pasta de SPAM ou bloqueado pelo servidor.

**Solução:**
1. Verifique pasta de **SPAM/Lixo eletrônico**
2. Adicione o remetente à lista de contatos confiáveis
3. Verifique se o servidor SMTP permite envio automático

### **Problema 4: "Cron job não executa"**

**Causa:** Extensão pg_cron não ativada ou job mal configurado.

**Solução:**
```sql
-- 1. Verificar se pg_cron está ativo
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Se não aparecer nada, ativar:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Verificar se job está ativo:
SELECT jobname, schedule, active FROM cron.job;

-- 4. Se active = false, reativar:
UPDATE cron.job SET active = true WHERE jobname = 'daily-emails-morning';
```

### **Problema 5: "Cannot invoke Edge Function"**

**Causa:** URL ou Authorization incorretas.

**Solução:**
1. Verifique se o `Project URL` está correto
2. Verifique se a `anon key` está correta
3. Teste manualmente com cURL primeiro

---

## 📊 MONITORIZAÇÃO CONTÍNUA

### **Script para verificar saúde do sistema:**

```sql
-- Dashboard de status
SELECT 
  j.jobname,
  j.schedule,
  j.active,
  (SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) as total_runs,
  (SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid AND jrd.status = 'succeeded') as successful_runs,
  (SELECT MAX(start_time) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) as last_run
FROM cron.job j
WHERE j.jobname = 'daily-emails-morning';
```

### **Ver últimos erros:**

```sql
SELECT 
  start_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-emails-morning')
  AND status != 'succeeded'
ORDER BY start_time DESC
LIMIT 5;
```

---

## ✅ CHECKLIST FINAL

Antes de considerar a configuração completa, verifique:

- [ ] ✅ SMTP configurado e testado em `/settings`
- [ ] ✅ Notificações ativadas no perfil
- [ ] ✅ Teste manual via cURL funcionou
- [ ] ✅ Extensão `pg_cron` ativada
- [ ] ✅ Cron job criado no SQL Editor
- [ ] ✅ Cron job aparece como `active = true`
- [ ] ✅ Email de teste recebido
- [ ] ✅ Logs da Edge Function sem erros

---

## 📞 SUPORTE

Se continuar com problemas:

1. **Verifique os logs** da Edge Function no Dashboard
2. **Execute o teste manual** via cURL para ver erro detalhado
3. **Verifique a tabela** `cron.job_run_details` para ver histórico
4. **Consulte a documentação** oficial do Supabase sobre [pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)

---

### **Job 2: Automação de Workflows (Verificação de Gatilhos)**

Este job verifica diariamente:
- 🎂 Aniversários de leads
- 📅 Datas importantes personalizadas
- ⏰ Leads sem contacto há 3+ dias
- 💤 Leads sem atividade há 7+ dias

```sql
SELECT cron.schedule(
  'workflow-automation-check',
  '0 7 * * *',  -- Todos os dias às 07:00 UTC
  $$
  SELECT
    net.http_post(
      url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/workflow-automation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SUA_ANON_KEY',
        'Content-Type', 'application/json'
      )
    ) AS request_id;
  $$
);
```

**⚠️ IMPORTANTE:** Substitua `SEU_PROJECT_REF` e `SUA_ANON_KEY` pelos valores reais!

---

## ✅ CHECKLIST FINAL

Antes de considerar a configuração completa, verifique:

- [ ] ✅ SMTP configurado e testado em `/settings`
- [ ] ✅ Notificações ativadas no perfil
- [ ] ✅ Teste manual via cURL funcionou
- [ ] ✅ Extensão `pg_cron` ativada
- [ ] ✅ Cron job criado no SQL Editor
- [ ] ✅ Cron job aparece como `active = true`
- [ ] ✅ Email de teste recebido
- [ ] ✅ Logs da Edge Function sem erros

---

## 📞 SUPORTE

Se continuar com problemas:

1. **Verifique os logs** da Edge Function no Dashboard
2. **Execute o teste manual** via cURL para ver erro detalhado
3. **Verifique a tabela** `cron.job_run_details` para ver histórico
4. **Consulte a documentação** oficial do Supabase sobre [pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)

---

**Última atualização:** 2026-01-12  
**Versão:** 1.0