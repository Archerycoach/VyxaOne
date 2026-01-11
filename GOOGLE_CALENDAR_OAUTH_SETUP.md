# Configuração Google Calendar OAuth - www.vyxa.pt

## 1️⃣ Configurar no Google Cloud Console

### Passo 1: Aceder ao Google Cloud Console
1. Vai a: https://console.cloud.google.com
2. Seleciona o projeto ou cria um novo

### Passo 2: Ativar Google Calendar API
1. No menu lateral, vai a **APIs & Services** → **Library**
2. Procura "Google Calendar API"
3. Clica em **Enable**

### Passo 3: Criar Credenciais OAuth 2.0
1. Vai a **APIs & Services** → **Credentials**
2. Clica em **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Se for a primeira vez, configura o **OAuth consent screen**:
   - **User Type**: External
   - **App name**: Vyxa (ou o nome que quiseres)
   - **User support email**: o teu email
   - **Developer contact**: o teu email
   - **Scopes**: Adiciona os scopes necessários:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/userinfo.email`
   - **Test users**: Adiciona os emails dos utilizadores que vão testar

### Passo 4: Configurar o OAuth Client ID
1. **Application type**: Web application
2. **Name**: Vyxa - Google Calendar Integration
3. **Authorized JavaScript origins**:
   ```
   https://www.vyxa.pt
   ```
4. **Authorized redirect URIs** (CRÍTICO - adiciona todos):
   ```
   https://www.vyxa.pt/api/google-calendar/callback
   ```

### Passo 5: Copiar as Credenciais
Após criar, vais receber:
- **Client ID**: Começa com algo como `645506690625-...apps.googleusercontent.com`
- **Client Secret**: Uma string aleatória

**⚠️ IMPORTANTE: Guarda estas credenciais - vais precisar delas no próximo passo!**

---

## 2️⃣ Configurar no Supabase (via Admin Dashboard)

### Opção A: Usar a Interface de Admin (RECOMENDADO)

1. **Aceder à página de Integrações**:
   - Vai a: https://www.vyxa.pt/admin/integrations
   - Faz login como administrador

2. **Configurar Google Calendar**:
   - Procura a secção "Google Calendar"
   - Clica em "Configurar" ou "Editar"
   - Preenche:
     - **Client ID**: Cole o Client ID do Google Cloud Console
     - **Client Secret**: Cole o Client Secret
     - **Redirect URI**: `https://www.vyxa.pt/api/google-calendar/callback`
   - Clica em "Guardar"

### Opção B: Configurar Diretamente no Supabase (SQL)

Se preferires usar SQL diretamente:

```sql
-- Inserir/Atualizar configurações do Google Calendar
INSERT INTO integration_settings (
  service_name,
  client_id,
  client_secret,
  redirect_uri,
  enabled,
  created_at,
  updated_at
)
VALUES (
  'google_calendar',
  'O_TEU_CLIENT_ID_AQUI',
  'O_TEU_CLIENT_SECRET_AQUI',
  'https://www.vyxa.pt/api/google-calendar/callback',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (service_name)
DO UPDATE SET
  client_id = EXCLUDED.client_id,
  client_secret = EXCLUDED.client_secret,
  redirect_uri = EXCLUDED.redirect_uri,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
```

---

## 3️⃣ Configurar Variáveis de Ambiente na Vercel

1. **Ir à Vercel Dashboard**:
   - https://vercel.com/dashboard
   - Seleciona o projeto Vyxa

2. **Settings** → **Environment Variables**

3. **Adicionar/Atualizar estas variáveis**:
   ```bash
   NEXT_PUBLIC_APP_URL=https://www.vyxa.pt
   NEXT_PUBLIC_SITE_URL=https://www.vyxa.pt
   GOOGLE_REDIRECT_URI=https://www.vyxa.pt/api/google-calendar/callback
   ```

4. **Aplicar a**: Production, Preview, Development

5. **Redeploy** o projeto para aplicar as alterações

---

## 4️⃣ Atualizar Templates de Email no Supabase

Já que estamos a configurar URLs, aproveita para atualizar os templates de email:

1. **Supabase Dashboard**: https://supabase.com/dashboard
2. **Seleciona o projeto**: `hantkriglxwmddbpddnw`
3. **Authentication** → **URL Configuration**

**Configurações necessárias:**

```
Site URL: https://www.vyxa.pt
```

**Redirect URLs:**
```
https://www.vyxa.pt/**
https://www.vyxa.pt/api/google-calendar/callback
https://www.vyxa.pt/auth/callback
http://localhost:3000/**
http://localhost:3000/api/google-calendar/callback
```

---

## 5️⃣ Testar a Integração

1. **Aceder ao Calendário**:
   - https://www.vyxa.pt/calendar

2. **Clicar em "Conectar Google Calendar"**

3. **Autorizar a aplicação no Google**:
   - Seleciona a conta Google
   - Aceita as permissões
   - Deves ser redirecionado de volta para www.vyxa.pt

4. **Verificar Sincronização**:
   - Os eventos devem aparecer no calendário
   - Podes criar eventos que sincronizam com o Google Calendar

---

## 🔧 Troubleshooting

### Erro: "redirect_uri_mismatch"
- ✅ Verifica que o Redirect URI no Google Cloud Console é EXATAMENTE:
  - `https://www.vyxa.pt/api/google-calendar/callback`
- ✅ Sem espaços, sem `/` extra no final
- ✅ Com `https://` no início

### Erro: "access_denied"
- ✅ Verifica que o utilizador está nos "Test Users" no OAuth Consent Screen
- ✅ Ou publica a aplicação (se estiver pronta)

### Erro: "invalid_client"
- ✅ Verifica que o Client ID e Client Secret estão corretos
- ✅ Verifica que estão guardados corretamente na tabela `integration_settings`

### Eventos não sincronizam
- ✅ Verifica os logs no Supabase: Dashboard → Logs
- ✅ Verifica se o `refresh_token` foi guardado corretamente
- ✅ Tenta desconectar e reconectar

---

## 📝 Checklist Final

- [ ] Google Calendar API ativada no Google Cloud Console
- [ ] OAuth Client ID criado com redirect URI correto
- [ ] Credenciais guardadas no Supabase (via admin ou SQL)
- [ ] Variáveis de ambiente atualizadas na Vercel
- [ ] Redeploy feito na Vercel
- [ ] Site URL e Redirect URLs configurados no Supabase Auth
- [ ] Testado com sucesso a conexão ao Google Calendar

---

## 🆘 Suporte

Se continuares a ter problemas:
1. Verifica os logs do browser (F12 → Console)
2. Verifica os logs no Supabase Dashboard
3. Confirma que todos os URLs estão corretos (sem erros de digitação)
4. Tenta com uma conta Google diferente