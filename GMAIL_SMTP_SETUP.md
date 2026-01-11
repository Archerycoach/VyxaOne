# 📧 Guia: Configurar Envio de Emails via Gmail SMTP

Este guia mostra como configurar o envio de emails automáticos através de uma conta Gmail usando SMTP, substituindo o MailerSend.

---

## 🎯 **O QUE VAMOS CONFIGURAR**

- **Provedor SMTP:** Gmail (Google Workspace ou Gmail pessoal)
- **Protocolo:** SMTP com TLS
- **Autenticação:** App Password (senha de aplicação)
- **Funcionalidades:**
  - ✅ Emails de notificação (tarefas, eventos, leads)
  - ✅ Templates de email
  - ✅ Envio em massa (bulk emails)
  - ✅ Edge Functions (daily-emails)

---

## 📋 **PRÉ-REQUISITOS**

Antes de começar:

- ✅ Conta Gmail ativa (pessoal ou Google Workspace)
- ✅ Verificação em 2 etapas ativada (obrigatório para App Passwords)
- ✅ Acesso ao painel de administração da conta Google
- ✅ Acesso ao código do projeto Imogest

---

## 🚀 **PARTE 1: CONFIGURAR GMAIL**

### **PASSO 1: Ativar Verificação em 2 Etapas**

A verificação em 2 etapas é **obrigatória** para criar App Passwords.

```
1. Aceder: https://myaccount.google.com/security
2. Procurar seção "Verificação em duas etapas"
3. Clicar "Começar" ou "Ativar"
4. Seguir assistente de configuração:
   - Adicionar número de telefone
   - Escolher método (SMS, Chamada, ou App Authenticator)
   - Confirmar código recebido
5. Verificar status: "Ativada" ✅
```

**Screenshot esperado:**
```
┌──────────────────────────────────────────┐
│  Verificação em duas etapas              │
├──────────────────────────────────────────┤
│                                          │
│  Status: ✅ Ativada                      │
│                                          │
│  Dispositivos confiáveis: 2              │
│  Códigos de backup: 10                   │
│                                          │
└──────────────────────────────────────────┘
```

---

### **PASSO 2: Criar App Password (Senha de Aplicação)**

App Passwords permitem aplicações externas enviarem emails via Gmail sem expor sua senha principal.

```
1. Aceder: https://myaccount.google.com/apppasswords
   (ou https://myaccount.google.com/security → "Senhas de app")

2. Se solicitado, fazer login novamente

3. Clicar "Selecionar app":
   - Escolher "Outro (nome personalizado)"
   - Nome: Imogest CRM
   - Clicar "Gerar"

4. Copiar senha gerada (16 caracteres):
   Exemplo: abcd efgh ijkl mnop
   
5. ⚠️ IMPORTANTE: Guardar em local seguro!
   Esta senha só será mostrada UMA VEZ.

6. Clicar "Concluído"
```

**Formato da senha:**
```
Formato mostrado: abcd efgh ijkl mnop
Formato para usar: abcdefghijklmnop (sem espaços)
```

---

### **PASSO 3: Anotar Credenciais SMTP**

Guardar estas informações (vamos usar no código):

```
┌────────────────────────────────────────┐
│  Credenciais Gmail SMTP               │
├────────────────────────────────────────┤
│                                        │
│  SMTP Host: smtp.gmail.com            │
│  SMTP Port: 587 (TLS)                 │
│  Username: seu-email@gmail.com        │
│  Password: abcdefghijklmnop           │
│  From Email: seu-email@gmail.com      │
│  From Name: Imogest CRM               │
│                                        │
└────────────────────────────────────────┘
```

**Notas:**
- **Port 587:** TLS (recomendado)
- **Port 465:** SSL (alternativo)
- **Port 25:** Bloqueado pela maioria dos ISPs

---

## 🔧 **PARTE 2: CONFIGURAR CÓDIGO**

### **PASSO 4: Instalar Biblioteca Nodemailer**

Nodemailer é a biblioteca Node.js para envio de emails via SMTP.

```bash
# No terminal, pasta raiz do projeto
npm install nodemailer
npm install --save-dev @types/nodemailer
```

**Verificar instalação:**
```bash
npm list nodemailer
# Deve mostrar: nodemailer@6.x.x
```

---

### **PASSO 5: Configurar Variáveis de Ambiente**

Adicionar credenciais Gmail ao arquivo `.env.local`:

```bash
# .env.local

# ========================================
# GMAIL SMTP CONFIGURATION
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM_EMAIL=seu-email@gmail.com
SMTP_FROM_NAME=Imogest CRM

# ========================================
# MAILERSEND (DESATIVADO - Opcional)
# ========================================
# MAILERSEND_API_KEY=your_mailersend_key_aqui
# MAILERSEND_FROM_EMAIL=noreply@imogest.com
# MAILERSEND_FROM_NAME=Imogest
```

**Notas:**
- ✅ `SMTP_SECURE=false` para port 587 (TLS)
- ✅ `SMTP_SECURE=true` para port 465 (SSL)
- ✅ `SMTP_PASS` é a App Password (16 caracteres, sem espaços)

---

### **PASSO 6: Criar Serviço de Email com Nodemailer**

Criar arquivo `src/services/gmailService.ts`:

```typescript
import nodemailer from "nodemailer";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configurar transporter Gmail
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true para 465, false para 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  console.log("📧 [gmailService] Creating SMTP transporter:", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
  });

  return nodemailer.createTransporter(config);
};

/**
 * Enviar email via Gmail SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailResponse> => {
  try {
    console.log("📧 [gmailService] sendEmail called");
    console.log("📧 [gmailService] To:", options.to);
    console.log("📧 [gmailService] Subject:", options.subject);

    // Validar variáveis de ambiente
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("Gmail SMTP credentials not configured");
    }

    // Criar transporter
    const transporter = createTransporter();

    // Preparar opções de email
    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME || "Imogest CRM",
        address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      },
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Fallback text
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(", ") : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc) : undefined,
      replyTo: options.replyTo,
    };

    console.log("📧 [gmailService] Sending email...");

    // Enviar email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [gmailService] Email sent successfully");
    console.log("📧 [gmailService] Message ID:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ [gmailService] Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Testar conexão SMTP
 */
export const testConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("🔍 [gmailService] Testing SMTP connection...");

    const transporter = createTransporter();
    await transporter.verify();

    console.log("✅ [gmailService] SMTP connection successful");
    return { success: true };
  } catch (error) {
    console.error("❌ [gmailService] SMTP connection failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Enviar email de notificação de tarefa
 */
export const sendTaskNotification = async (
  to: string,
  userName: string,
  tasks: Array<{ title: string; description?: string; priority: string; due_time?: string }>
): Promise<EmailResponse> => {
  const tasksList = tasks
    .map((task, index) => {
      const priorityEmoji = task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢";
      const time = task.due_time ? ` (${task.due_time})` : "";
      return `
        <div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid #4F46E5; background: #F9FAFB;">
          <strong>${priorityEmoji} ${task.title}</strong>${time}
          ${task.description ? `<br><span style="color: #6B7280;">${task.description}</span>` : ""}
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📋 Tarefas para Hoje</h1>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          Olá <strong>${userName}</strong>,
        </p>
        
        <p style="margin-bottom: 20px;">
          Você tem <strong>${tasks.length} tarefa(s)</strong> agendada(s) para hoje:
        </p>
        
        ${tasksList}
        
        <div style="margin-top: 30px; padding: 15px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 4px;">
          <p style="margin: 0; color: #065F46;">
            💡 <strong>Dica:</strong> Acesse o Imogest para visualizar todos os detalhes e atualizar o status das suas tarefas.
          </p>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/tasks" 
             style="display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Ver Tarefas
          </a>
        </div>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #6B7280; font-size: 12px;">
        <p>Imogest CRM - Sistema de Gestão Imobiliária</p>
        <p>Este é um email automático, por favor não responda.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `📋 Suas tarefas para hoje - ${new Date().toLocaleDateString("pt-PT")}`,
    html,
  });
};

/**
 * Enviar email de nova lead atribuída
 */
export const sendLeadAssignedNotification = async (
  to: string,
  agentName: string,
  leadName: string,
  leadEmail?: string,
  leadPhone?: string
): Promise<EmailResponse> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #10B981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">🎯 Nova Lead Atribuída</h1>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          Olá <strong>${agentName}</strong>,
        </p>
        
        <p style="margin-bottom: 20px;">
          Uma nova lead foi atribuída a você:
        </p>
        
        <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #4F46E5; font-size: 20px;">${leadName}</h2>
          
          ${leadEmail ? `
          <p style="margin: 5px 0;">
            <strong>📧 Email:</strong> <a href="mailto:${leadEmail}" style="color: #4F46E5;">${leadEmail}</a>
          </p>
          ` : ""}
          
          ${leadPhone ? `
          <p style="margin: 5px 0;">
            <strong>📱 Telefone:</strong> <a href="tel:${leadPhone}" style="color: #4F46E5;">${leadPhone}</a>
          </p>
          ` : ""}
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background: #FEF3C7; border-left: 3px solid #F59E0B; border-radius: 4px;">
          <p style="margin: 0; color: #92400E;">
            ⚡ <strong>Ação Recomendada:</strong> Entre em contato com a lead nas próximas 24 horas para maximizar as chances de conversão.
          </p>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/leads" 
             style="display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Ver Lead no CRM
          </a>
        </div>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #6B7280; font-size: 12px;">
        <p>Imogest CRM - Sistema de Gestão Imobiliária</p>
        <p>Este é um email automático, por favor não responda.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🎯 Nova Lead Atribuída: ${leadName}`,
    html,
  });
};
```

---

### **PASSO 7: Atualizar API de Teste**

Atualizar `src/pages/api/integrations/test-gmail.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmail, testConnection } from "@/services/gmailService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🧪 [test-gmail] Testing Gmail SMTP connection...");

    // Test 1: Verificar conexão SMTP
    const connectionTest = await testConnection();
    
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: "SMTP connection failed",
        details: connectionTest.error,
      });
    }

    console.log("✅ [test-gmail] SMTP connection successful");

    // Test 2: Enviar email de teste
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: "testEmail is required in request body",
      });
    }

    console.log("📧 [test-gmail] Sending test email to:", testEmail);

    const emailResult = await sendEmail({
      to: testEmail,
      subject: "🧪 Teste Gmail SMTP - Imogest CRM",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #4F46E5;">✅ Gmail SMTP Configurado!</h1>
          <p>Este é um email de teste do sistema Imogest CRM.</p>
          <p><strong>Status:</strong> Configuração Gmail SMTP funcionando corretamente.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">
            Email enviado em ${new Date().toLocaleString("pt-PT")}
          </p>
        </body>
        </html>
      `,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to send test email",
        details: emailResult.error,
      });
    }

    console.log("✅ [test-gmail] Test email sent successfully");

    return res.status(200).json({
      success: true,
      message: "Gmail SMTP configured and working",
      messageId: emailResult.messageId,
      connectionTest: "passed",
      emailTest: "passed",
    });
  } catch (error) {
    console.error("❌ [test-gmail] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
```

---

### **PASSO 8: Atualizar Edge Function daily-emails**

Atualizar `supabase/functions/daily-emails/index.ts` para usar Gmail:

```typescript
// No início do arquivo, substituir importação MailerSend por fetch para API

// Função auxiliar para enviar email via API Next.js
async function sendEmailViaAPI(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const apiUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
    
    const response = await fetch(`${apiUrl}/api/integrations/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, html }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Failed to send email:", error);
      return false;
    }

    console.log("✅ Email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
}

// Substituir chamadas sendEmail() pela nova função sendEmailViaAPI()
```

---

## 🧪 **PARTE 3: TESTAR CONFIGURAÇÃO**

### **PASSO 9: Testar Conexão SMTP**

**Teste via API:**

```bash
# Teste via cURL
curl -X POST http://localhost:3000/api/integrations/test-gmail \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "seu-email@example.com"}'
```

**Teste via Postman/Insomnia:**

```http
POST http://localhost:3000/api/integrations/test-gmail
Content-Type: application/json

{
  "testEmail": "seu-email@example.com"
}
```

**Response esperado:**

```json
{
  "success": true,
  "message": "Gmail SMTP configured and working",
  "messageId": "<unique-id@gmail.com>",
  "connectionTest": "passed",
  "emailTest": "passed"
}
```

---

### **PASSO 10: Verificar Email Recebido**

```
1. Abrir caixa de entrada do email de teste
2. Procurar email com assunto: "🧪 Teste Gmail SMTP - Imogest CRM"
3. Verificar:
   - ✅ Email chegou
   - ✅ Remetente: Imogest CRM <seu-email@gmail.com>
   - ✅ Formatação HTML correta
   - ✅ Sem erros de renderização
```

**Se email não chegar:**
```
1. Verificar pasta Spam/Lixo
2. Verificar logs do terminal (erros SMTP)
3. Verificar credenciais no .env.local
4. Testar conexão SMTP novamente
```

---

## 📊 **PARTE 4: LIMITES E QUOTAS**

### **Limites Gmail SMTP:**

| Tipo de Conta | Limite Diário | Limite por Hora |
|---|---|---|
| **Gmail Pessoal** | 500 emails/dia | ~50 emails/hora |
| **Google Workspace** | 2000 emails/dia | ~200 emails/hora |

**Notas:**
- Limite é por conta remetente, não por destinatário
- Emails em massa podem ser marcados como spam
- Recomendado: usar Google Workspace para produção

---

### **Boas Práticas:**

```
✅ NÃO enviar mais de 50 emails por hora
✅ Adicionar intervalo de 1-2 segundos entre emails em massa
✅ Usar templates profissionais (evitar spam filters)
✅ Incluir link de unsubscribe em emails marketing
✅ Monitorar bounce rate e spam complaints
✅ Usar endereço noreply@ para notificações automáticas
```

---

## 🔍 **TROUBLESHOOTING**

### **Erro 1: "Invalid login: 535-5.7.8 Username and Password not accepted"**

**Causa:** Credenciais incorretas ou App Password inválido

**Soluções:**
```
1. Verificar SMTP_USER (email completo)
2. Verificar SMTP_PASS (16 caracteres, sem espaços)
3. Regenerar App Password:
   - https://myaccount.google.com/apppasswords
   - Deletar antiga
   - Criar nova
4. Verificar verificação em 2 etapas está ativa
5. Aguardar 5-10 minutos após criar App Password
```

---

### **Erro 2: "Connection timeout" ou "ETIMEDOUT"**

**Causa:** Firewall bloqueando porta SMTP

**Soluções:**
```
1. Verificar porta:
   - Tentar 587 (TLS) - Recomendado
   - Tentar 465 (SSL)
   - Evitar 25 (bloqueado por ISPs)

2. Verificar firewall:
   - Permitir saída para smtp.gmail.com:587
   - Permitir saída para smtp.gmail.com:465

3. Testar conectividade:
   telnet smtp.gmail.com 587
   # Deve conectar sem timeout
```

---

### **Erro 3: Emails vão para Spam**

**Causa:** Falta de autenticação SPF/DKIM

**Soluções:**
```
1. Usar Google Workspace (tem SPF/DKIM configurado)

2. Adicionar SPF record no DNS:
   TXT: v=spf1 include:_spf.google.com ~all

3. Configurar DKIM no Google Workspace:
   - Admin Console → Apps → Gmail → Authenticate email
   - Gerar DKIM key
   - Adicionar TXT record no DNS

4. Melhorar conteúdo do email:
   - Evitar palavras spam (free, urgent, click here)
   - Incluir texto plain além de HTML
   - Adicionar link de unsubscribe
   - Usar domínio profissional (não @gmail.com)
```

---

### **Erro 4: "Daily user sending quota exceeded"**

**Causa:** Limite diário de 500 emails atingido

**Soluções:**
```
1. Aguardar 24 horas para reset do limite

2. Distribuir envios ao longo do dia:
   - Não enviar 500 emails de uma vez
   - Máximo 50 por hora

3. Upgrade para Google Workspace:
   - Limite aumenta para 2000/dia
   - Melhor deliverability

4. Usar serviço dedicado para bulk emails:
   - SendGrid, Mailgun, Amazon SES
   - Manter Gmail para notificações importantes
```

---

## ✅ **VERIFICAÇÃO FINAL**

### **Checklist de Sucesso:**

- [ ] Verificação em 2 etapas ativada no Gmail
- [ ] App Password criada e guardada
- [ ] Nodemailer instalado (`npm list nodemailer`)
- [ ] Variáveis de ambiente configuradas (`.env.local`)
- [ ] Serviço gmailService.ts criado
- [ ] API de teste criada
- [ ] Teste de conexão passou
- [ ] Email de teste recebido
- [ ] Sem erros no console
- [ ] Remetente aparece como "Imogest CRM"

---

## 🚀 **PRÓXIMOS PASSOS**

### **1. Integrar com Edge Functions:**

```typescript
// Em supabase/functions/daily-emails/index.ts
// Substituir MailerSend por chamadas à API /send-email

const emailResult = await fetch(`${appUrl}/api/integrations/send-email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: user.email,
    subject: "Suas tarefas para hoje",
    html: emailHtml,
  }),
});
```

---

### **2. Implementar Rate Limiting:**

```typescript
// Adicionar delay entre emails em massa
for (const recipient of recipients) {
  await sendEmail({ ... });
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
}
```

---

### **3. Monitoramento:**

```typescript
// Criar log de emails enviados
const emailLog = {
  sent_at: new Date(),
  to: recipient,
  subject: subject,
  status: success ? "delivered" : "failed",
  error: error?.message,
};

await supabase.from("email_logs").insert(emailLog);
```

---

### **4. Upgrade para Google Workspace (Recomendado):**

**Benefícios:**
- ✅ Limite maior: 2000 emails/dia
- ✅ Domínio profissional: noreply@seudominio.com
- ✅ SPF/DKIM pré-configurado
- ✅ Melhor deliverability
- ✅ Suporte prioritário

**Como:**
```
1. Aceder: https://workspace.google.com
2. Criar conta Google Workspace
3. Configurar domínio personalizado
4. Gerar App Password para workspace email
5. Atualizar SMTP_USER no .env.local
```

---

## 📞 **SUPORTE**

### **Recursos Úteis:**

- 📖 Gmail SMTP Docs: https://support.google.com/mail/answer/7126229
- 📖 Nodemailer Docs: https://nodemailer.com/about/
- 📖 App Passwords: https://support.google.com/accounts/answer/185833
- 📖 Google Workspace: https://workspace.google.com

---

## 🎉 **CONCLUSÃO**

Gmail SMTP está configurado e funcionando!

**Funcionalidades Disponíveis:**
- ✅ Notificações de tarefas diárias
- ✅ Notificações de eventos
- ✅ Alertas de novas leads
- ✅ Emails em massa (com rate limiting)
- ✅ Templates personalizados

**Próximos Passos:**
1. ✅ Testar todos os tipos de notificações
2. ✅ Monitorar deliverability
3. ✅ Considerar upgrade para Google Workspace
4. ✅ Implementar logs de emails

---

🚀 **Gmail SMTP configurado com sucesso!**