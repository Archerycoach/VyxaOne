# 🚀 IMOGEST CRM - SETUP INSTRUCTIONS

## 📋 OVERVIEW

Este documento guia-te através da configuração de uma base de dados **completamente nova** para o Imogest CRM, separando ambientes de **Produção** e **Testes**.

---

## 🎯 STEP 1: CREATE NEW SUPABASE PROJECTS

### **1.1 Production Project**
1. Vai a [supabase.com](https://supabase.com)
2. Cria novo projeto: **"imogest-production"**
3. Escolhe região: **Europe (Frankfurt)** ou **Europe (London)**
4. Define password forte
5. **Guarda as credenciais:**
   - `Project URL`
   - `anon/public key`
   - `service_role key`

### **1.2 Testing Project**
1. Repete o processo acima
2. Nome do projeto: **"imogest-testing"**
3. **Guarda as credenciais separadamente**

---

## 🗄️ STEP 2: SETUP DATABASE SCHEMA

### **2.1 Run SQL Schema**

**Para AMBOS os projetos (Production + Testing):**

1. Abre Supabase Dashboard
2. Vai para **SQL Editor**
3. Cria nova query
4. **Copia todo o conteúdo de `database-schema.sql`**
5. **Executa o script** (pode demorar 1-2 minutos)
6. Verifica se executou sem erros

### **2.2 Verify Tables Created**

No Supabase Dashboard > Table Editor, deves ver:

✅ **Core Tables:**
- `profiles`
- `leads`
- `properties`
- `contacts`
- `tasks`
- `calendar_events`

✅ **Supporting Tables:**
- `interactions`
- `documents`
- `templates`
- `notifications`
- `activity_logs`

✅ **Business Tables:**
- `subscriptions`
- `subscription_plans`
- `payment_history`
- `system_settings`

---

## 🔧 STEP 3: CONFIGURE ENVIRONMENT VARIABLES

### **3.1 Create `.env.local.production`**

```bash
# Production Environment
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Stripe (Production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Eupago (Production)
NEXT_PUBLIC_EUPAGO_API_KEY=your-production-eupago-key

# Google Calendar (Production)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-production-domain.com/api/google-calendar/callback

# App Config
NODE_ENV=production
```

### **3.2 Create `.env.local.testing`**

```bash
# Testing Environment
NEXT_PUBLIC_SUPABASE_URL=https://your-testing-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-testing-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-testing-service-role-key

# Stripe (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxx

# Eupago (Test)
NEXT_PUBLIC_EUPAGO_API_KEY=your-testing-eupago-key

# Google Calendar (Testing)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback

# App Config
NODE_ENV=development
```

### **3.3 Switch Between Environments**

```bash
# Use Testing Environment (default for development)
cp .env.local.testing .env.local

# Use Production Environment (only when deploying)
cp .env.local.production .env.local
```

---

## 👤 STEP 4: CREATE FIRST ADMIN USER

### **4.1 Via Supabase Dashboard**

**Para AMBOS os projetos:**

1. Vai para **Authentication > Users**
2. Clica em **"Add user"**
3. Preenche:
   - Email: `admin@imogest.com` (ou teu email)
   - Password: `Admin123!@#` (muda depois)
   - ✅ **Auto Confirm User**
4. Clica em **"Create user"**

### **4.2 Set Admin Role**

1. Vai para **Table Editor > profiles**
2. Encontra o user que criaste
3. Edita o registo:
   - `role`: `admin`
   - `full_name`: `Administrator`
   - `is_active`: `true`
4. Guarda

---

## 🔐 STEP 5: CONFIGURE AUTHENTICATION

### **5.1 Enable Email Provider**

Em **Authentication > Providers**:
1. ✅ Enable **Email**
2. Configura **Email Templates** (opcional)

### **5.2 Configure Email Templates (Optional)**

Personaliza templates em **Authentication > Email Templates**:
- Confirmation email
- Reset password email
- Magic link email

### **5.3 Setup Site URL**

Em **Authentication > URL Configuration**:
- **Site URL**: `https://your-domain.com` (production)
- **Site URL**: `http://localhost:3000` (testing)

### **5.4 Add Redirect URLs**

Adiciona URLs permitidas:
```
https://your-domain.com/**
http://localhost:3000/**
https://*-your-team.vercel.app/**
```

---

## 💳 STEP 6: CONFIGURE PAYMENT PROVIDERS

### **6.1 Stripe Setup**

1. Cria conta em [stripe.com](https://stripe.com)
2. Activa **Test Mode** primeiro
3. Copia as keys de **Developers > API Keys**
4. Cria Webhook endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `customer.subscription.*`, `invoice.*`, `payment_intent.*`
5. Copia **Webhook Secret**

### **6.2 Eupago Setup**

1. Cria conta em [eupago.pt](https://eupago.pt)
2. Copia **API Key** do dashboard
3. Configura Webhook:
   - URL: `https://your-domain.com/api/eupago/webhook`

---

## 📧 STEP 7: CONFIGURE EMAIL (SMTP)

### **Option A: Using Supabase Email (Development)**
- Já configurado automaticamente
- **Limitado a 3 emails/hora** em projetos free

### **Option B: Using Custom SMTP (Production)**

Adiciona ao `.env.local.production`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@imogest.com
```

**Providers recomendados:**
- [SendGrid](https://sendgrid.com) - 100 emails/day free
- [Mailgun](https://mailgun.com) - 5000 emails/month free
- [AWS SES](https://aws.amazon.com/ses/) - muito barato

---

## 🔄 STEP 8: GENERATE TYPESCRIPT TYPES

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Generate types for Testing project
supabase gen types typescript --project-id your-testing-project-id > src/integrations/supabase/database.types.ts

# Generate types for Production project (quando necessário)
supabase gen types typescript --project-id your-production-project-id > src/integrations/supabase/database.types.ts
```

---

## 🧪 STEP 9: TEST THE SETUP

### **9.1 Start Development Server**

```bash
# Make sure .env.local points to TESTING environment
cp .env.local.testing .env.local

# Install dependencies
npm install

# Start server
npm run dev
```

### **9.2 Test Authentication**

1. Abre `http://localhost:3000`
2. Faz login com o admin user criado
3. Verifica que carrega o dashboard

### **9.3 Test Database Operations**

1. Vai para **Leads**
2. Cria um novo lead
3. Verifica que aparece na lista
4. Edita o lead
5. Deleta o lead

### **9.4 Test User Creation**

1. Vai para **Admin > Users**
2. Cria novo utilizador
3. Verifica que:
   - Utilizador criado com sucesso
   - Aparece na lista
   - Pode fazer login

---

## 🚀 STEP 10: DEPLOY TO PRODUCTION

### **10.1 Update Vercel Environment Variables**

No Vercel Dashboard > Settings > Environment Variables:

**Adiciona as variáveis de `.env.local.production`:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- etc...

### **10.2 Deploy**

```bash
git add .
git commit -m "feat: new database schema"
git push origin main
```

Vercel vai fazer deploy automaticamente.

### **10.3 Verify Production**

1. Abre `https://your-domain.vercel.app`
2. Testa todas as funcionalidades
3. Verifica logs em Vercel

---

## 📊 STEP 11: MONITORING & MAINTENANCE

### **11.1 Setup Monitoring**

- **Supabase Dashboard**: Monitoring > Performance
- **Vercel Analytics**: Analytics tab
- **Sentry** (opcional): Para error tracking

### **11.2 Regular Backups**

Em Supabase Dashboard > Settings > Backups:
- Activa **Point-in-Time Recovery** (paid plans)
- Ou faz backups manuais semanalmente

### **11.3 Database Maintenance**

```sql
-- Run monthly to optimize database
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## ✅ CHECKLIST

Use esta checklist para garantir que tudo está configurado:

### **Database Setup**
- [ ] Production Supabase project criado
- [ ] Testing Supabase project criado
- [ ] Schema SQL executado em ambos
- [ ] Tabelas criadas corretamente
- [ ] Indexes criados
- [ ] RLS policies activadas

### **Authentication**
- [ ] Admin user criado em ambos ambientes
- [ ] Admin role definido
- [ ] Email provider activado
- [ ] Redirect URLs configuradas
- [ ] Site URLs configuradas

### **Environment Variables**
- [ ] `.env.local.production` criado
- [ ] `.env.local.testing` criado
- [ ] `.env.local` aponta para testing
- [ ] Vercel env vars configuradas

### **Payment Providers**
- [ ] Stripe test keys configuradas
- [ ] Stripe webhooks configurados
- [ ] Eupago API key configurada

### **Testing**
- [ ] Development server funciona
- [ ] Login funciona
- [ ] CRUD operations funcionam
- [ ] User creation funciona

### **Production**
- [ ] Deployed to Vercel
- [ ] Production database funciona
- [ ] Payments funcionam
- [ ] Monitoring configurado

---

## 🆘 TROUBLESHOOTING

### **Issue: "Invalid API key"**
- Verifica que copiaste as keys correctas
- Confirma que usaste `anon key` no frontend e `service_role` no backend

### **Issue: "Row Level Security policy violation"**
- Verifica que o user tem o role correcto em `profiles`
- Confirma que as RLS policies foram criadas

### **Issue: "Foreign key constraint violation"**
- Verifica ordem de criação dos registos
- Usa IDs que existem nas tabelas relacionadas

### **Issue: TypeScript type errors**
- Regenera os types: `supabase gen types typescript`
- Reinicia o servidor: `npm run dev`

---

## 📚 ADDITIONAL RESOURCES

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

## 🎉 NEXT STEPS

Agora que a base de dados está configurada:

1. ✅ Testa todas as funcionalidades em **Testing**
2. ✅ Popula com dados de exemplo
3. ✅ Convida equipa para testar
4. ✅ Deploy para **Production** quando estável
5. ✅ Monitoriza performance e erros

**Boa sorte com o Imogest CRM! 🚀**