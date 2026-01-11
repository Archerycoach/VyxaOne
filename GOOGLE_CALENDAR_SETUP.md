# 📅 Guia de Configuração - Google Calendar Integration

Este guia explica como configurar a integração com Google Calendar no CRM Imogest.

---

## 🎯 **OVERVIEW**

A integração permite:
- ✅ Sincronização bidirecional de eventos
- ✅ Criar eventos no CRM que aparecem no Google Calendar
- ✅ Importar eventos do Google Calendar para o CRM
- ✅ Alertas automáticos de aniversários

---

## 📋 **PRÉ-REQUISITOS**

1. Conta Google (Gmail)
2. Acesso ao Google Cloud Console
3. Projeto Vercel/domínio configurado

---

## 🚀 **PASSO 1: Criar Projeto no Google Cloud**

### **1.1. Aceder ao Google Cloud Console**
```
URL: https://console.cloud.google.com
```

### **1.2. Criar Novo Projeto**
1. Clicar no **seletor de projetos** (topo esquerdo)
2. Clicar **"Novo Projeto"**
3. Preencher:
   ```
   Nome do Projeto: Imogest CRM
   Localização: (deixar padrão)
   ```
4. Clicar **"Criar"**
5. Aguardar criação (pode demorar alguns segundos)
6. Selecionar o projeto criado

---

## 🔑 **PASSO 2: Ativar Google Calendar API**

### **2.1. Aceder à Biblioteca de APIs**
1. Menu lateral → **"APIs e Serviços"** → **"Biblioteca"**
2. Pesquisar: `Google Calendar API`
3. Clicar no resultado **"Google Calendar API"**
4. Clicar **"Ativar"**
5. Aguardar ativação (alguns segundos)

✅ **API ativada com sucesso!**

---

## 🔐 **PASSO 3: Criar Credenciais OAuth 2.0**

### **3.1. Configurar Tela de Consentimento**

1. Menu lateral → **"APIs e Serviços"** → **"Tela de consentimento OAuth"**

2. Escolher tipo de usuário:
   ```
   ⚪ Interno (apenas para G Suite)
   🔘 Externo (qualquer conta Google)
   ```
   Selecionar **"Externo"** → Clicar **"Criar"**

3. **Passo 1/4 - Informações do App:**
   ```
   Nome do App: Imogest CRM
   Email de suporte: seu-email@gmail.com
   Logo: (opcional)
   Domínio da aplicação: https://seu-dominio.vercel.app
   Links da política de privacidade: (opcional)
   Links dos termos de serviço: (opcional)
   ```
   Clicar **"Salvar e Continuar"**

4. **Passo 2/4 - Escopos:**
   - Clicar **"Adicionar ou remover escopos"**
   - Pesquisar: `calendar`
   - Selecionar:
     ```
     ✅ https://www.googleapis.com/auth/calendar
     ```
   - Clicar **"Atualizar"**
   - Clicar **"Salvar e Continuar"**

5. **Passo 3/4 - Usuários de Teste:**
   - Clicar **"Adicionar Usuários"**
   - Adicionar emails que vão testar:
     ```
     seu-email@gmail.com
     colaborador@gmail.com
     ```
   - Clicar **"Adicionar"**
   - Clicar **"Salvar e Continuar"**

6. **Passo 4/4 - Resumo:**
   - Revisar informações
   - Clicar **"Voltar ao Painel"**

✅ **Tela de consentimento configurada!**

---

### **3.2. Criar Credenciais OAuth**

1. Menu lateral → **"APIs e Serviços"** → **"Credenciais"**

2. Clicar **"+ Criar Credenciais"** (topo)

3. Selecionar **"ID do cliente OAuth"**

4. Configurar:
   ```
   Tipo de aplicação: Aplicativo da Web
   
   Nome: Imogest CRM Web Client
   
   URIs de redirecionamento autorizados:
   ┌────────────────────────────────────────────────────┐
   │ https://seu-dominio.vercel.app/api/google-calendar/callback │
   └────────────────────────────────────────────────────┘
   
   (Para desenvolvimento local, adicionar também:)
   ┌────────────────────────────────────────────────────┐
   │ http://localhost:3000/api/google-calendar/callback         │
   └────────────────────────────────────────────────────┘
   ```

5. Clicar **"Criar"**

6. **IMPORTANTE - Guardar Credenciais:**
   ```
   ┌──────────────────────────────────────────┐
   │ ID do cliente OAuth criado               │
   ├──────────────────────────────────────────┤
   │ ID do cliente:                           │
   │ 123456789-abc.apps.googleusercontent.com │
   │                                          │
   │ Chave secreta do cliente:                │
   │ GOCSPX-abc123def456ghi789               │
   │                                          │
   │ [Fazer o download do JSON]               │
   └──────────────────────────────────────────┘
   ```

   **COPIAR E GUARDAR:**
   - ✅ ID do cliente (Client ID)
   - ✅ Chave secreta (Client Secret)

✅ **Credenciais OAuth criadas!**

---

## ⚙️ **PASSO 4: Configurar Variáveis de Ambiente**

### **4.1. Atualizar `.env.local`**

No seu projeto, editar o ficheiro `.env.local`:

```env
# Google Calendar API Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://seu-dominio.vercel.app/api/google-calendar/callback
```

**Substituir:**
- `SEU_CLIENT_ID_AQUI` → ID do cliente copiado
- `SEU_CLIENT_SECRET_AQUI` → Chave secreta copiada
- `seu-dominio.vercel.app` → Seu domínio real

**Exemplo:**
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://imogest.vercel.app/api/google-calendar/callback
```

---

### **4.2. Configurar no Vercel (Produção)**

1. Ir para dashboard Vercel
2. Selecionar projeto
3. **Settings** → **Environment Variables**
4. Adicionar as 3 variáveis:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID
→ Value: [seu client ID]
→ Environments: Production, Preview, Development

GOOGLE_CLIENT_SECRET
→ Value: [seu client secret]
→ Environments: Production, Preview, Development

NEXT_PUBLIC_GOOGLE_REDIRECT_URI
→ Value: https://seu-dominio.vercel.app/api/google-calendar/callback
→ Environments: Production, Preview, Development
```

5. Clicar **"Save"**
6. **Redeploy** o projeto para aplicar as variáveis

---

## 🧪 **PASSO 5: Testar Integração**

### **5.1. Desenvolvimento Local**

1. Reiniciar servidor Next.js:
   ```bash
   npm run dev
   ```

2. Aceder: `http://localhost:3000/calendar`

3. Clicar botão **"Conectar Google"**

4. **Fluxo esperado:**
   ```
   1. Redireciona para login Google
   2. Escolher conta Google
   3. Tela de consentimento:
      "Imogest CRM quer acessar sua Conta do Google"
      ✓ Ver, editar, compartilhar e excluir permanentemente 
        todos os calendários que você pode acessar usando 
        o Google Agenda
   4. Clicar "Continuar"
   5. Redireciona de volta para /calendar
   6. ✅ Status: "Conectado e sincronizado"
   ```

---

### **5.2. Testar Sincronização**

**Criar evento no CRM:**
```
1. Clicar "Novo Evento"
2. Preencher:
   Título: Teste Sincronização
   Data: Amanhã
   Hora: 10:00
3. Criar
4. ✅ Abrir Google Calendar → Evento deve aparecer
```

**Importar do Google:**
```
1. Abrir Google Calendar
2. Criar evento: "Teste Importação"
3. Voltar ao CRM
4. Clicar "Importar do Google"
5. ✅ Evento deve aparecer no CRM
```

---

## ⚠️ **RESOLUÇÃO DE PROBLEMAS**

### **Erro 403: Access Denied**

**Causa:** Usuário não está na lista de "Usuários de Teste"

**Solução:**
1. Google Cloud Console
2. APIs e Serviços → Tela de consentimento OAuth
3. Usuários de teste → Adicionar usuários
4. Adicionar email da conta Google que vai testar
5. Salvar

---

### **Erro 400: redirect_uri_mismatch**

**Causa:** Redirect URI não corresponde

**Solução:**
1. Verificar `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://SEU-DOMINIO/api/google-calendar/callback
   ```

2. Google Cloud Console → Credenciais
3. Editar OAuth 2.0 Client
4. URIs de redirecionamento autorizados → Adicionar:
   ```
   https://SEU-DOMINIO/api/google-calendar/callback
   ```
5. Salvar

---

### **Erro 401: invalid_client**

**Causa:** Client ID ou Secret incorretos

**Solução:**
1. Verificar `.env.local`
2. Comparar com valores do Google Cloud Console
3. Copiar novamente se necessário
4. Reiniciar servidor

---

### **Eventos não sincronizam**

**Possíveis causas:**

1. **Token expirado:**
   - Desconectar e reconectar Google Calendar

2. **Permissões insuficientes:**
   - Verificar se scope `calendar` está autorizado

3. **API desativada:**
   - Verificar se Google Calendar API está ativada

---

## 🔒 **SEGURANÇA**

### **Boas Práticas:**

1. **Nunca commit credenciais:**
   ```bash
   # .gitignore deve conter:
   .env.local
   .env*.local
   ```

2. **Tokens no banco de dados:**
   - ✅ Guardados encriptados no Supabase
   - ✅ Refresh automático quando expiram

3. **Scopes mínimos:**
   - ✅ Apenas `calendar` (não pedimos acesso a Gmail, Drive, etc.)

4. **Revogação:**
   - Usuários podem revogar acesso a qualquer momento
   - Google: myaccount.google.com/permissions

---

## 📊 **VERIFICAÇÃO FINAL**

**Checklist de configuração completa:**

```
✅ Projeto criado no Google Cloud
✅ Google Calendar API ativada
✅ Tela de consentimento configurada
✅ Credenciais OAuth criadas
✅ Redirect URI configurado corretamente
✅ Usuários de teste adicionados
✅ Variáveis de ambiente configuradas (.env.local)
✅ Variáveis de ambiente no Vercel (produção)
✅ Teste local funcionando
✅ Sincronização CRM → Google funcionando
✅ Sincronização Google → CRM funcionando
```

---

## 🎉 **CONFIGURAÇÃO CONCLUÍDA!**

A integração com Google Calendar está totalmente funcional.

**Funcionalidades disponíveis:**
- ✅ Conectar/Desconectar Google Calendar
- ✅ Criar eventos que sincronizam automaticamente
- ✅ Editar eventos sincronizados
- ✅ Apagar eventos sincronizados
- ✅ Importar eventos do Google
- ✅ Alertas automáticos de aniversário

---

## 📞 **SUPORTE**

Se encontrar problemas:

1. Verificar logs no console do browser (F12)
2. Verificar logs do servidor Next.js
3. Verificar Supabase logs
4. Verificar Google Cloud Console → Logs

**Erros comuns e soluções estão documentados na seção "Resolução de Problemas" acima.**

---

## 📚 **RECURSOS ADICIONAIS**

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)