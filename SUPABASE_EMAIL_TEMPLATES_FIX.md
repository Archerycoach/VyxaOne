# 🔧 CORREÇÃO DO ERRO "Database error querying schema"

**Data:** 2026-01-12  
**Problema:** Erro 500 ao fazer login  
**Causa:** Configuração de email no Supabase sem SMTP configurado  
**Status:** ⚠️ Requer ação no Supabase Dashboard

---

## 🎯 **PROBLEMA IDENTIFICADO:**

O erro **"Database error querying schema"** ocorre porque:
1. ✅ A base de dados está 100% correta
2. ✅ Os utilizadores estão criados e confirmados
3. ❌ **MAS o Supabase Auth está configurado para exigir confirmação de email**
4. ❌ **Sem SMTP configurado, não consegue enviar emails**
5. ❌ Resulta em erro interno 500

---

## ✅ **SOLUÇÃO IMEDIATA:**

### **PASSO 1: Desativar Confirmação de Email**

Aceda ao [Supabase Dashboard](https://supabase.com/dashboard) e siga estes passos:

```
1. Selecione o projeto: ykkorjrxomtevcdlyaan (Vyxa.pt)

2. Navegue para:
   Authentication → Providers → Email

3. Desative as seguintes opções:
   [❌] Confirm email
   [❌] Secure email change  
   [❌] Enable email confirmations

4. Clique em "Save" (Guardar)
```

**⚠️ CRÍTICO:** Estas opções **DEVEM** estar desligadas se não tiver SMTP configurado!

---

### **PASSO 2: Verificar URL Configuration**

```
1. Navegue para:
   Authentication → URL Configuration

2. Verifique:
   Site URL: https://www.vyxa.pt
   
3. Adicione Redirect URLs:
   - https://www.vyxa.pt/**
   - http://localhost:3000/**

4. Clique em "Save"
```

---

### **PASSO 3: Verificar Auth Settings**

```
1. Navegue para:
   Settings → Auth

2. Verifique:
   [✅] Enable Email provider
   JWT Expiry: 3600 (1 hora)
   [✅] Enable Refresh Token Rotation

3. Garanta que está DESLIGADO:
   [❌] Confirm email
   [❌] Secure email change

4. Clique em "Save"
```

---

## 🔐 **CREDENCIAIS DE LOGIN:**

Após fazer as configurações acima, pode fazer login com:

```
═══════════════════════════════════════════════════════════
📋 CREDENCIAIS DE ACESSO - VYXA.PT
═══════════════════════════════════════════════════════════

👤 ADMINISTRADOR:
   📧 Email: eduardotsantos@remax.pt
   🔑 Password: Vyxa2026!
   🎭 Role: admin

👤 AGENTE 1:
   📧 Email: filipesanches@remax.pt
   🔑 Password: Vyxa2026!
   🎭 Role: agent

👤 AGENTE 2:
   📧 Email: anafaia@remax.pt
   🔑 Password: Vyxa2026!
   🎭 Role: agent

═══════════════════════════════════════════════════════════
⚠️  IMPORTANTE: Altere estas passwords após o primeiro login!
═══════════════════════════════════════════════════════════
```

---

## 📊 **ESTADO ATUAL DA BASE DE DADOS:**

### **✅ 100% CORRETO:**
- ✅ 3 utilizadores criados
- ✅ Todos os emails confirmados
- ✅ Todas as identities criadas
- ✅ Passwords encriptadas
- ✅ Tokens limpos (sem pendências)
- ✅ Sessões antigas removidas
- ✅ Schema auth com permissões corretas
- ✅ Estrutura completa (24 tabelas, 7 extensões)

### **❌ PRECISA SER CORRIGIDO NO DASHBOARD:**
- ❌ Confirmação de email DEVE estar desligada
- ⚠️ URL Configuration pode precisar de ajuste
- ⚠️ Redirect URLs podem estar em falta

---

## 🎯 **ALTERNATIVA: CONFIGURAR SMTP (OPCIONAL)**

Se preferir **manter a confirmação de email** ativada, precisa configurar SMTP:

### **Opção 1: Gmail SMTP**

```
Authentication → Email Templates → SMTP Settings

Host: smtp.gmail.com
Port: 587
Username: seu-email@gmail.com
Password: [App Password - não a password normal!]

⚠️ IMPORTANTE: 
1. Ative "2-Step Verification" no Gmail
2. Crie uma "App Password" em:
   Google Account → Security → App passwords
```

### **Opção 2: SendGrid**

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [Sua SendGrid API Key]
```

### **Opção 3: AWS SES**

```
Host: email-smtp.[region].amazonaws.com
Port: 587
Username: [SMTP Username]
Password: [SMTP Password]
```

Após configurar SMTP, pode **RE-ATIVAR**:
- [✅] Confirm email
- [✅] Secure email change

---

## 🧪 **TESTE APÓS CONFIGURAÇÃO:**

### **1. Teste de Login:**
```bash
1. Vá para: https://www.vyxa.pt/login
2. Email: eduardotsantos@remax.pt
3. Password: Vyxa2026!
4. Clique "Entrar"
5. ✅ Deve entrar no dashboard sem erros!
```

### **2. Verificar Console do Navegador:**
```bash
1. Abra DevTools (F12)
2. Vá para "Console"
3. Faça login
4. ✅ Não deve haver erros de rede
5. ✅ Deve ver: "POST https://ykkorjrxomtevcdlyaan.supabase.co/auth/v1/token 200"
```

### **3. Verificar Token JWT:**
```bash
1. Após login bem-sucedido
2. Vá para "Application" (DevTools)
3. Vá para "Local Storage"
4. Procure por "supabase.auth.token"
5. ✅ Deve ver um token JWT válido
```

---

## ❓ **TROUBLESHOOTING:**

### **Problema: Continua a dar erro 500**
**Solução:**
1. Limpe cache do navegador (Ctrl+Shift+Del)
2. Feche e abra o navegador
3. Tente fazer login novamente
4. Se persistir, verifique se salvou as configurações no Dashboard

### **Problema: Erro "Invalid login credentials"**
**Solução:**
1. Verifique se escreveu o email corretamente
2. Password é: `Vyxa2026!` (com maiúscula e exclamação)
3. Se ainda falhar, pode ser cache - limpe o browser

### **Problema: Página fica em branco após login**
**Solução:**
1. Verifique se `NEXT_PUBLIC_APP_URL` está correto no `.env.local`
2. Verifique se "Site URL" no Dashboard está correto
3. Reinicie o servidor Next.js: `pm2 restart all`

---

## 📝 **CHECKLIST DE CONFIGURAÇÃO:**

Use esta checklist para garantir que tudo está correto:

```
[❌] Confirm email DESLIGADO no Dashboard
[❌] Secure email change DESLIGADO no Dashboard  
[❌] Enable email confirmations DESLIGADO no Dashboard
[  ] Site URL = https://www.vyxa.pt
[  ] Redirect URLs incluem www.vyxa.pt/** e localhost:3000/**
[  ] JWT Expiry = 3600
[  ] Enable Email provider LIGADO
[  ] Enable Refresh Token Rotation LIGADO
[  ] .env.local tem as credenciais corretas do projeto ykkorjrxomtevcdlyaan
[  ] Servidor Next.js reiniciado após mudanças
```

---

## 🎊 **APÓS CORREÇÃO:**

Quando o login funcionar:

1. ✅ **Altere as passwords** de todos os utilizadores
2. ✅ **Configure Google Calendar** (Admin → Integrações)
3. ✅ **Verifique permissões** de cada role
4. ✅ **Teste todas as funcionalidades** do sistema
5. ✅ **Configure SMTP** se quiser confirmação de email

---

## 📞 **SUPORTE:**

Se após seguir todos os passos o problema persistir:

1. Tire screenshot do erro no Console (F12)
2. Tire screenshot das configurações no Dashboard
3. Verifique se `.env.local` tem as credenciais corretas
4. Reinicie o servidor: `pm2 restart all`

---

**Documento criado por:** Softgen AI  
**Data:** 2026-01-12 00:40 UTC  
**Versão:** 1.0  
**Próxima revisão:** Após correção das configurações