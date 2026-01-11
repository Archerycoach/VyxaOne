# 🚀 Guia de Deployment para Produção - IMOGEST

## ⚠️ REGRA DE OURO
**NUNCA faça deployment direto sem backup e testes!**

## 📝 Pré-Requisitos

### 1. Configuração de Ambientes

Você deve ter **2 projetos Supabase separados**:

- **🧪 DESENVOLVIMENTO** (Testing) - Para testes e desenvolvimento
  - URL: `https://hantkriglxwmddbpddnw.supabase.co` (seu ambiente atual)
  
- **🌐 PRODUÇÃO** (Production) - Para clientes/utilizadores finais
  - URL: `https://seu-projeto-producao.supabase.co` (a criar)

### 2. Backups Automáticos

**No Supabase Dashboard de PRODUÇÃO:**
1. Vá para **Database** → **Backups**
2. Ative **Daily Backups** (backups diários automáticos)
3. Configure **Point-in-Time Recovery (PITR)** se disponível no seu plano

---

## 🔄 Processo de Deployment Seguro

### FASE 1: Preparação (Ambiente de Desenvolvimento)

#### 1.1. Teste Completo no Ambiente de Desenvolvimento
```bash
# 1. Certifique-se que tudo funciona localmente
npm run build
npm run lint
npm run type-check  # se tiver este script

# 2. Teste todas as funcionalidades críticas:
# - Login/Registro
# - CRUD de leads, propriedades, tarefas
# - Calendário e integrações
# - Relatórios e analytics
# - Subscriptions e pagamentos
```

#### 1.2. Revisar Todas as Migrações
```bash
# Liste todas as migrações em supabase/migrations/
ls -la supabase/migrations/

# Revise cada migração para garantir que são SEGURAS:
# ✅ SEGURO: CREATE TABLE, ADD COLUMN, CREATE INDEX
# ✅ SEGURO: ALTER TABLE ADD, CREATE FUNCTION, CREATE TRIGGER
# ⚠️ CUIDADO: ALTER TABLE DROP, DROP TABLE, DELETE FROM
# ❌ NUNCA: TRUNCATE, DROP DATABASE
```

#### 1.3. Documente as Alterações
Crie um ficheiro `CHANGELOG.md` com:
- Novas funcionalidades adicionadas
- Bugs corrigidos
- Alterações na base de dados
- Novas variáveis de ambiente necessárias

---

### FASE 2: Backup de Produção (CRÍTICO!)

#### 2.1. Backup Manual Antes do Deployment

**No Supabase Dashboard de PRODUÇÃO:**
```
1. Database → Backups → "Create Backup Now"
2. Espere até o backup completar (pode demorar alguns minutos)
3. Anote o timestamp do backup: ex: 2025-12-30-12-00-00
4. Baixe uma cópia local se possível (Database → Backups → Download)
```

#### 2.2. Backup de Dados Críticos (SQL)

Execute no SQL Editor de PRODUÇÃO:
```sql
-- Backup de dados críticos antes do deployment
-- Copie os resultados e guarde num ficheiro local

-- 1. Contagem de registos (para validação pós-deployment)
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'properties', COUNT(*) FROM properties
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions;

-- 2. Backup de configurações críticas
SELECT * FROM system_settings;

-- 3. Lista de utilizadores ativos
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC;
```

**Guarde estes resultados num ficheiro:** `backup-pre-deployment-2025-12-30.sql`

---

### FASE 3: Deployment das Migrações

#### 3.1. Ambiente de Produção - Supabase

**Opção A: Via Supabase Dashboard (RECOMENDADO para migrações complexas)**

1. Vá para o **SQL Editor** do projeto de PRODUÇÃO
2. Para cada migração em `supabase/migrations/` (por ordem cronológica):
   ```sql
   -- Abra o ficheiro 20251227123119_migration_69d6ff01.sql
   -- Copie o conteúdo
   -- Cole no SQL Editor
   -- Clique em "Run" e verifique se executou sem erros
   ```

3. **IMPORTANTE**: Execute uma migração de cada vez e verifique:
   - ✅ Mensagem "Success" no SQL Editor
   - ✅ Nenhum erro na consola
   - ✅ Tabelas/colunas criadas corretamente

**Opção B: Via Supabase CLI (para utilizadores avançados)**

```bash
# 1. Instale o Supabase CLI se ainda não tiver
npm install -g supabase

# 2. Login no Supabase
supabase login

# 3. Link ao projeto de PRODUÇÃO
supabase link --project-ref SEU_PROJECT_REF_PRODUCAO

# 4. Aplique as migrações
supabase db push

# 5. Verifique se todas foram aplicadas
supabase migration list
```

#### 3.2. Validação Pós-Migrações

Execute no SQL Editor de PRODUÇÃO:
```sql
-- Valide que as tabelas existem e têm os campos corretos
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Valide que as RLS policies estão ativas
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Valide que os triggers estão ativos
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Compare contagens de registos (devem ser iguais ao backup)
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'properties', COUNT(*) FROM properties;
-- ... etc
```

---

### FASE 4: Deployment da Aplicação (Vercel)

#### 4.1. Configure Variáveis de Ambiente em Produção

**No Vercel Dashboard:**
1. Vá para **Settings** → **Environment Variables**
2. Configure para o ambiente **Production**:

```bash
# Supabase - Projeto de PRODUÇÃO
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-producao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_producao
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_producao
SUPABASE_DB_PASSWORD=sua_senha_db_producao

# Stripe (se usar para pagamentos)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Eupago (se usar para pagamentos PT)
EUPAGO_API_KEY=sua_api_key_producao

# Google Calendar (se integração estiver ativa)
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret

# URL da Aplicação
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

#### 4.2. Deploy no Vercel

```bash
# Opção A: Via Git (RECOMENDADO)
# 1. Commit todas as alterações
git add .
git commit -m "chore: deployment para produção - [data]"
git push origin main  # ou master

# 2. O Vercel fará deployment automático do branch main/master

# Opção B: Via CLI do Vercel
vercel --prod
```

#### 4.3. Verifique o Deployment

1. Acesse `https://seu-dominio.vercel.app`
2. Teste funcionalidades críticas:
   - ✅ Login funciona
   - ✅ Dashboard carrega
   - ✅ Criar/editar leads funciona
   - ✅ Criar/editar propriedades funciona
   - ✅ Calendário sincroniza
   - ✅ Notificações aparecem

---

### FASE 5: Monitorização Pós-Deployment

#### 5.1. Monitorize Erros (Primeiras 24h)

**Vercel Dashboard:**
- **Functions** → Verifique logs de erros
- **Analytics** → Verifique tráfego e performance

**Supabase Dashboard:**
- **Database** → **Logs** → Verifique queries lentas ou com erro
- **Auth** → **Users** → Verifique se novos utilizadores conseguem registar-se

#### 5.2. Checklist de Validação

```
□ Utilizadores conseguem fazer login
□ Novos registos funcionam
□ Dashboard carrega sem erros
□ CRUD de leads funciona (Create, Read, Update, Delete)
□ CRUD de propriedades funciona
□ CRUD de tarefas funciona
□ Calendário sincroniza com Google Calendar
□ Notificações são enviadas corretamente
□ Relatórios geram dados corretos
□ Pagamentos funcionam (Stripe/Eupago)
□ Emails são enviados (confirmação, reset password)
□ Performance está aceitável (<2s tempo de carregamento)
```

---

## 🆘 Plano de Rollback (Se Algo Correr Mal)

### Rollback da Aplicação (Vercel)

```bash
# Opção A: Via Vercel Dashboard
# 1. Vá para Deployments
# 2. Encontre o deployment anterior que funcionava
# 3. Clique nos 3 pontos → "Promote to Production"

# Opção B: Via Git
git revert HEAD  # reverte o último commit
git push origin main
```

### Rollback da Base de Dados (Supabase)

**Opção A: Restaurar Backup Automático**
1. Database → Backups
2. Selecione o backup de antes do deployment
3. Clique em "Restore"
4. ⚠️ ATENÇÃO: Isto vai **substituir** todos os dados atuais!

**Opção B: Rollback Manual de Migrações**

Se apenas algumas migrações causaram problemas:
```sql
-- Exemplo: Se adicionou uma coluna e quer remover
ALTER TABLE leads DROP COLUMN IF EXISTS nova_coluna;

-- Exemplo: Se criou uma tabela e quer remover
DROP TABLE IF EXISTS nova_tabela CASCADE;

-- Exemplo: Se alterou uma função
DROP FUNCTION IF EXISTS nova_funcao CASCADE;
CREATE OR REPLACE FUNCTION funcao_antiga() ...
```

---

## 🔐 Segurança e Boas Práticas

### 1. Variáveis de Ambiente

**NUNCA commit ao Git:**
- ❌ `.env.local`
- ❌ `.env.production`
- ❌ Chaves API
- ❌ Passwords

**Verificação:**
```bash
# Confirme que .env.local está no .gitignore
cat .gitignore | grep .env
```

### 2. Chaves de API Diferentes

Use **chaves diferentes** para desenvolvimento e produção:
- Desenvolvimento: `pk_test_...`, `sk_test_...` (Stripe)
- Produção: `pk_live_...`, `sk_live_...` (Stripe)

### 3. Monitorização Contínua

Configure alertas no:
- **Vercel**: Alertas de downtime e erros
- **Supabase**: Alertas de uso de recursos
- **Sentry** (opcional): Monitorização de erros em tempo real

---

## 📊 Checklist Final de Deployment

### PRÉ-DEPLOYMENT
- [ ] Backup de produção criado e verificado
- [ ] Todas as migrações testadas em desenvolvimento
- [ ] Variáveis de ambiente de produção configuradas
- [ ] Changelog documentado
- [ ] Equipa notificada sobre o deployment

### DURANTE DEPLOYMENT
- [ ] Migrações aplicadas sem erros
- [ ] Aplicação deployada no Vercel
- [ ] Testes manuais passaram
- [ ] Logs verificados (sem erros críticos)

### PÓS-DEPLOYMENT
- [ ] Validação de funcionalidades críticas
- [ ] Contagem de registos corresponde ao esperado
- [ ] Performance está aceitável
- [ ] Utilizadores conseguem aceder normalmente
- [ ] Monitorização ativa por 24-48h

---

## 🎯 Fluxo de Trabalho Recomendado

```
┌─────────────────────────────────────────┐
│  1. DESENVOLVIMENTO (Local + Dev DB)   │
│     - Código novo                       │
│     - Testes unitários                  │
│     - Migrações criadas                 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  2. STAGING (Vercel Preview + Dev DB)  │
│     - Deploy automático de branches     │
│     - Testes de integração              │
│     - Review de código                  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  3. PRODUÇÃO (Vercel + Production DB)  │
│     - Backup ANTES de qualquer mudança  │
│     - Migrações aplicadas               │
│     - Deploy do branch main/master      │
│     - Monitorização 24-48h              │
└─────────────────────────────────────────┘
```

---

## 📞 Suporte e Recursos

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Última Atualização:** 2025-12-30
**Versão:** 1.0
**Mantido por:** Equipa IMOGEST