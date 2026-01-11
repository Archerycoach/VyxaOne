# 🚀 Guia de Deploy para Vercel - imogest

## 📋 Pré-requisitos

Antes de fazer deploy na Vercel, você precisa:

1. ✅ Conta na Vercel (https://vercel.com)
2. ✅ Projeto conectado ao GitHub
3. ✅ Credenciais do Supabase (URL e API Keys)
4. ✅ Outras API keys necessárias (Stripe, Google, etc.)

---

## 🔧 Passo 1: Configurar Variáveis de Ambiente na Vercel

### **Como Acessar as Configurações:**

1. **Ir para o Dashboard da Vercel:**
   - URL: https://vercel.com/dashboard
   - Fazer login com sua conta

2. **Selecionar o Projeto:**
   - Clicar no projeto `imogest` (ou nome do seu projeto)

3. **Abrir Configurações:**
   - Clicar em **Settings** (⚙️) no menu superior
   - No menu lateral, clicar em **Environment Variables**

---

## 🔑 Passo 2: Adicionar Variáveis de Ambiente

### **IMPORTANTE: Adicionar TODAS estas variáveis**

Copie as variáveis abaixo e adicione uma por uma na Vercel:

#### **🔵 Supabase (OBRIGATÓRIO)**

```bash
# Supabase URL
NEXT_PUBLIC_SUPABASE_URL=https://hantkriglxwmddbpddnw.supabase.co

# Supabase Anon Key (chave pública)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbnRrcmlnbHh3bWRkYnBkZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNzkzODcsImV4cCI6MjA4MjY1NTM4N30.PfH8SnoaOCSQOGEMWOsRgRZH9UyggeQQIiZ6Elqlvtw

# Supabase Service Role Key (chave secreta - NUNCA compartilhar!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbnRrcmlnbHh3bWRkYnBkZG53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA3OTM4NywiZXhwIjoyMDgyNjU1Mzg3fQ.HRwgdLzPZ-DNjcMnKu8HVW80QjiWGo9vKN_w0jYmHng

# Supabase Database Password
SUPABASE_DB_PASSWORD=1#AmphiprioN.
```

#### **💳 Stripe (Pagamentos)**

```bash
# Stripe Publishable Key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51QQKjSJBpxeKs0dJqvJLd8c7KuxYzTDTABjfDi4O1C1KSGCl0BQzJU4vWYLmqxQy0ghzIIpz9PNRZe3aLrL35GkK00PvCqgZ8w

# Stripe Secret Key
STRIPE_SECRET_KEY=sk_test_51QQKjSJBpxeKs0dJz7IjDJV7S0YjCOjK0yEqvK9d0vHdY1YfVZ1eHwYJw5A3mLxgpNVFwqJ3Mf3I6sO8J7R8M5v100v89aTlhU

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_zKw8lzM5K5GvgW8J9L5E0K8j9L5E0K8j9
```

#### **💶 Eupago (Pagamentos Portugal)**

```bash
# Eupago API Key
EUPAGO_API_KEY=demo-dd2f6cc5-0a94-401a-b0b9-6a1e27e01234
```

#### **📅 Google Calendar**

```bash
# Google Client ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

# Google Client Secret
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Google Redirect URI (ATUALIZAR com URL da Vercel)
GOOGLE_REDIRECT_URI=https://seu-projeto.vercel.app/api/google/callback

# Google API Key
NEXT_PUBLIC_GOOGLE_API_KEY=your-google-api-key
```

#### **💬 WhatsApp Business API**

```bash
# WhatsApp Phone Number ID
NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# WhatsApp Access Token
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
```

#### **📧 Email (Resend)**

```bash
# Resend API Key
RESEND_API_KEY=re_your_resend_api_key
```

#### **🌍 Outras Configurações**

```bash
# Site URL (ATUALIZAR após deploy)
NEXT_PUBLIC_SITE_URL=https://seu-projeto.vercel.app

# App URL
NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app

# Mapbox Token (se usar mapas)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token

# OpenAI API Key (se usar IA)
OPENAI_API_KEY=sk-proj-your_openai_api_key

# Node Environment
NODE_ENV=production
```

---

## 📝 Como Adicionar Cada Variável na Vercel

### **Método Manual (Recomendado para primeira vez):**

1. **Clicar em "Add New"**
2. **Preencher os campos:**
   - **Key:** Nome da variável (ex: `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value:** Valor da variável (ex: `https://hantkriglxwmddbpddnw.supabase.co`)
   - **Environments:** Selecionar:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. **Clicar em "Save"**
4. **Repetir para todas as variáveis acima**

### **Método Rápido (Importar de arquivo):**

1. **Criar arquivo local:** `vercel-env-vars.txt`
2. **Copiar todas as variáveis acima** (formato `KEY=VALUE`)
3. **Na Vercel:** Clicar em "Import .env" ou "Add Multiple"
4. **Colar o conteúdo** do arquivo
5. **Selecionar ambientes:** Production, Preview, Development
6. **Salvar**

---

## 🔄 Passo 3: Redeploy do Projeto

Após adicionar todas as variáveis de ambiente:

### **Opção 1: Redeploy Automático**
1. Na página do projeto na Vercel
2. Ir para a aba **Deployments**
3. Clicar no deployment mais recente
4. Clicar em **⋯ (três pontos)** → **Redeploy**
5. Confirmar o redeploy

### **Opção 2: Push para GitHub**
```bash
# Fazer um commit vazio para forçar novo deploy
git commit --allow-empty -m "chore: trigger vercel redeploy"
git push origin main
```

---

## ⚙️ Passo 4: Configurar URLs no Supabase

**CRÍTICO:** Após o deploy na Vercel, você precisa atualizar as URLs no Supabase:

### **Como Configurar:**

1. **Ir para Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Selecionar projeto: `hantkriglxwmddbpddnw`

2. **Configurar Authentication URLs:**
   - Menu lateral: **Authentication** → **URL Configuration**
   
3. **Adicionar estas URLs** (substituir `seu-projeto.vercel.app` pela URL real):

**Site URL:**
```
https://seu-projeto.vercel.app
```

**Additional Redirect URLs:**
```
https://seu-projeto.vercel.app/**
https://seu-projeto.vercel.app/api/auth/callback
https://*.vercel.app/**
```

4. **Salvar alterações**

---

## ✅ Passo 5: Verificar Deploy

### **Checklist de Verificação:**

1. **Build Passou:**
   - [ ] Verificar logs da Vercel
   - [ ] Confirmar que build completou sem erros

2. **Variáveis de Ambiente:**
   - [ ] Todas as variáveis estão configuradas na Vercel
   - [ ] Ambientes corretos selecionados (Production/Preview/Development)

3. **URLs Configuradas:**
   - [ ] Site URL configurado no Supabase
   - [ ] Redirect URLs incluem domínio da Vercel
   - [ ] Google Redirect URI atualizado (se usar Google Calendar)

4. **Funcionalidades Testadas:**
   - [ ] Login funciona
   - [ ] Dashboard carrega
   - [ ] Dados são salvos no Supabase
   - [ ] Pagamentos funcionam (se configurados)

---

## 🐛 Troubleshooting

### **Erro: "Missing Supabase environment variables"**

**Causa:** Variáveis de ambiente não configuradas na Vercel

**Solução:**
1. Verificar que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão na Vercel
2. Verificar que estão nos 3 ambientes (Production/Preview/Development)
3. Fazer redeploy do projeto

---

### **Erro: "NetworkError when attempting to fetch resource"**

**Causa:** URLs não configuradas no Supabase

**Solução:**
1. Ir para Supabase Dashboard → Authentication → URL Configuration
2. Adicionar URL da Vercel em Site URL
3. Adicionar `https://seu-projeto.vercel.app/**` em Redirect URLs
4. Aguardar 1-2 minutos para propagação

---

### **Erro: "Invalid API key" ou "401 Unauthorized"**

**Causa:** API key incorreta ou expirada

**Solução:**
1. Ir para Supabase Dashboard → Settings → API
2. Copiar nova Anon Key
3. Atualizar na Vercel: Settings → Environment Variables
4. Redeploy

---

### **Build Fails com Erro de TypeScript**

**Causa:** Erros de tipo não detectados localmente

**Solução:**
```bash
# Rodar build localmente primeiro
npm run build

# Corrigir erros mostrados
# Fazer commit e push
git add .
git commit -m "fix: resolve build errors"
git push origin main
```

---

## 📊 Exemplo de Configuração Completa na Vercel

### **Environment Variables (Visualização):**

```
┌─────────────────────────────────────────────────────────────────┐
│ Environment Variables                                     Add ▼  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ NEXT_PUBLIC_SUPABASE_URL                                        │
│ https://hantkriglxwmddbpddnw.supabase.co                       │
│ 🌍 Production | Preview | Development                           │
│                                                                  │
│ NEXT_PUBLIC_SUPABASE_ANON_KEY                                   │
│ eyJhbGci...                                                     │
│ 🌍 Production | Preview | Development                           │
│                                                                  │
│ SUPABASE_SERVICE_ROLE_KEY                                       │
│ eyJhbGci...                                                     │
│ 🔒 Production | Preview | Development                           │
│                                                                  │
│ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY                              │
│ pk_test_...                                                     │
│ 🌍 Production | Preview | Development                           │
│                                                                  │
│ STRIPE_SECRET_KEY                                               │
│ sk_test_...                                                     │
│ 🔒 Production | Preview | Development                           │
│                                                                  │
│ ... (todas as outras variáveis)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

✅ 15 environment variables configured
```

---

## 🎯 Checklist Final

Antes de considerar o deploy completo, verificar:

- [ ] **Vercel:**
  - [ ] Todas as variáveis de ambiente adicionadas
  - [ ] Build passou sem erros
  - [ ] Site está acessível
  
- [ ] **Supabase:**
  - [ ] Site URL configurado com URL da Vercel
  - [ ] Redirect URLs incluem wildcard (`/**`)
  - [ ] Projeto está ativo (não pausado)
  
- [ ] **Stripe (se configurado):**
  - [ ] Webhook configurado com URL da Vercel
  - [ ] Webhook secret atualizado
  
- [ ] **Google Calendar (se configurado):**
  - [ ] Redirect URI atualizado com URL da Vercel
  - [ ] Domínio autorizado no Google Console
  
- [ ] **Testes Funcionais:**
  - [ ] Login/Logout funciona
  - [ ] Dashboard carrega dados
  - [ ] Formulários salvam no banco
  - [ ] Notificações funcionam

---

## 🚀 Deploy de Produção vs Preview

### **Production:**
- Deploy do branch `main`
- URL: `https://seu-projeto.vercel.app`
- Usa variáveis de ambiente de Production

### **Preview:**
- Deploy de branches de feature ou PRs
- URL: `https://seu-projeto-git-branch.vercel.app`
- Usa variáveis de ambiente de Preview

### **Recomendação:**
- Configurar **as mesmas variáveis** nos 3 ambientes para evitar surpresas
- Usar ambientes diferentes apenas se tiver Supabase/Stripe separados para teste

---

## 📞 Suporte

Se encontrar problemas durante o deploy:

1. **Verificar logs da Vercel:**
   - Deployments → Clicar no deployment → Ver logs completos

2. **Testar localmente:**
   ```bash
   npm run build
   npm start
   ```

3. **Verificar variáveis:**
   - Vercel Dashboard → Settings → Environment Variables
   - Confirmar que todas estão presentes

4. **Consultar documentação:**
   - Vercel: https://vercel.com/docs
   - Supabase: https://supabase.com/docs
   - Next.js: https://nextjs.org/docs

---

## 🎉 Conclusão

Após seguir todos os passos acima, seu projeto estará:

✅ Deployado na Vercel
✅ Conectado ao Supabase
✅ Com todas as integrações funcionando
✅ Pronto para uso em produção

**Próximos passos:**
1. Configurar domínio customizado (opcional)
2. Configurar SSL/HTTPS (automático na Vercel)
3. Monitorar analytics e performance
4. Configurar alertas e notificações

Boa sorte com o deploy! 🚀