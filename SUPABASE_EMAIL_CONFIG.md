# 📧 Configuração de Emails no Supabase

## ⚠️ PROBLEMA: Emails de validação não são enviados

O Supabase precisa de configuração SMTP para enviar emails de confirmação, reset de password, etc.

---

## 🔧 SOLUÇÃO 1: Configurar SMTP Customizado (Recomendado para Produção)

### **1. Obter credenciais SMTP:**

Escolha um provedor de email:

#### **Opção A: Gmail (Gratuito, para testes)**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: seu-email@gmail.com
SMTP Password: [App Password - criar em security.google.com]
```

**⚠️ Gmail requer App Password:**
1. Ir para https://myaccount.google.com/security
2. Ativar "2-Step Verification"
3. Ir para "App passwords"
4. Criar nova senha para "Mail"
5. Usar essa senha (não a senha normal)

#### **Opção B: SendGrid (Recomendado para produção)**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [SendGrid API Key]
```

**Criar conta SendGrid:**
1. Ir para https://sendgrid.com
2. Criar conta grátis (100 emails/dia)
3. Ir para Settings → API Keys
4. Criar API Key
5. Copiar a chave

#### **Opção C: Resend (Moderno e fácil)**
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [Resend API Key]
```

#### **Opção D: Mailgun**
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: [Mailgun SMTP Username]
SMTP Password: [Mailgun SMTP Password]
```

---

### **2. Configurar no Supabase Dashboard:**

```
1. Ir para: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Clicar em "Settings" (ícone engrenagem)
3. Clicar em "Auth"
4. Scroll até "SMTP Settings"
5. Preencher:
   ✅ Enable Custom SMTP: ON
   ✅ Sender email: noreply@seudominio.com (ou seu email)
   ✅ Sender name: Imogest
   ✅ Host: smtp.sendgrid.net (ou outro)
   ✅ Port: 587
   ✅ User: apikey (ou seu user)
   ✅ Password: [SUA_API_KEY]
   ✅ Admin email: seu-email@empresa.com
6. Clicar "Save"
```

---

### **3. Configurar Email Templates:**

No Supabase Dashboard:
```
Settings → Auth → Email Templates
```

Editar os templates:

#### **Confirm Signup (Confirmação de Email):**
```html
<h2>Confirme o seu email</h2>
<p>Obrigado por se registar no Imogest!</p>
<p>Clique no link abaixo para confirmar o seu email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar Email</a></p>
<p>Este link expira em 24 horas.</p>
<p>Se não solicitou esta conta, ignore este email.</p>
```

#### **Reset Password:**
```html
<h2>Redefinir password</h2>
<p>Recebemos um pedido para redefinir a sua password.</p>
<p>Clique no link abaixo para criar uma nova password:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir Password</a></p>
<p>Este link expira em 1 hora.</p>
<p>Se não solicitou esta alteração, ignore este email.</p>
```

---

## 🔧 SOLUÇÃO 2: Desativar Confirmação de Email (Apenas para Desenvolvimento)

**⚠️ NÃO RECOMENDADO PARA PRODUÇÃO**

No Supabase Dashboard:
```
1. Ir para Settings → Auth
2. Scroll até "Email Auth"
3. Desativar "Enable email confirmations"
4. Clicar "Save"
```

**Consequências:**
- ❌ Qualquer pessoa pode criar conta sem validar email
- ❌ Emails falsos podem ser registados
- ❌ Não há proteção contra spam

---

## 🔧 SOLUÇÃO 3: Usar Supabase Email Service (Limitado)

O Supabase oferece um serviço de email básico **APENAS para desenvolvimento**:

**Limitações:**
- ⚠️ Máximo 4 emails por hora
- ⚠️ Emails podem ir para spam
- ⚠️ NÃO recomendado para produção

**Vantagem:**
- ✅ Funciona imediatamente sem configuração

Se está em desenvolvimento e só precisa testar, pode usar este serviço temporariamente.

---

## 🧪 TESTAR CONFIGURAÇÃO DE EMAIL:

### **Teste 1: Criar nova conta**
```
1. Ir para /login
2. Mudar para "Criar Conta"
3. Preencher dados
4. Clicar "Criar Conta"
5. Verificar inbox do email fornecido
6. Clicar no link de confirmação
```

### **Teste 2: Reset de password**
```
1. Ir para /forgot-password
2. Inserir email
3. Clicar "Enviar"
4. Verificar inbox
5. Clicar no link
6. Definir nova password
```

### **Teste 3: Logs do Supabase**
```
1. Ir para Supabase Dashboard
2. Clicar em "Logs" → "Auth Logs"
3. Procurar por eventos de email:
   - "user_confirmation_sent"
   - "user_recovery_requested"
4. Verificar se há erros
```

---

## 🐛 TROUBLESHOOTING:

### **Problema: Email não chega**

**Verificar:**
1. ✅ SMTP está ativado no Supabase
2. ✅ Credenciais SMTP estão corretas
3. ✅ Email do remetente está verificado (SendGrid/Mailgun)
4. ✅ Domínio tem SPF/DKIM configurado
5. ✅ Verificar pasta de spam
6. ✅ Verificar logs no Supabase Auth

### **Problema: Email vai para spam**

**Soluções:**
1. Configurar SPF record no DNS:
   ```
   TXT @ "v=spf1 include:sendgrid.net ~all"
   ```
2. Configurar DKIM no provedor de email
3. Usar domínio próprio verificado
4. Aumentar reputação do domínio (enviar gradualmente)

### **Problema: Rate limit exceeded**

**Solução:**
- Atualizar plano do Supabase
- Usar provedor SMTP dedicado (SendGrid, Mailgun)
- Implementar rate limiting no frontend

---

## 📋 CHECKLIST DE CONFIGURAÇÃO:

```
☐ Escolher provedor SMTP (SendGrid recomendado)
☐ Obter credenciais SMTP
☐ Configurar SMTP no Supabase Dashboard
☐ Editar templates de email
☐ Configurar redirect URLs para Vercel
☐ Testar envio de email de confirmação
☐ Testar reset de password
☐ Verificar logs do Supabase
☐ Configurar SPF/DKIM (produção)
☐ Monitorar taxa de entrega
```

---

## 🎯 RECOMENDAÇÃO FINAL:

**Para Produção:**
1. ✅ Usar SendGrid (até 100 emails/dia grátis)
2. ✅ Configurar domínio próprio
3. ✅ Ativar SPF/DKIM
4. ✅ Usar templates personalizados
5. ✅ Monitorar logs de entrega

**Para Desenvolvimento:**
1. ✅ Pode usar Gmail (com App Password)
2. ✅ Ou desativar confirmação temporariamente
3. ✅ Sempre testar antes de colocar em produção

---

## 📞 PRECISA DE AJUDA?

Se precisar de ajuda para configurar qualquer um destes métodos, me avise e posso:
- Criar conta no SendGrid/Resend
- Configurar DNS records
- Debugar problemas de entrega
- Criar templates customizados

**Qual método prefere usar? SendGrid, Gmail, ou outro?**