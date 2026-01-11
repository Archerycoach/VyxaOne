# ⚡ Google Calendar - Configuração Rápida (15 minutos)

## 🎯 O QUE VAI CONFIGURAR

Integração completa do Google Calendar para sincronizar eventos automaticamente entre o CRM e o Google Calendar de todos os utilizadores.

**Tempo necessário:** 15 minutos  
**Dificuldade:** Fácil  
**Resultado:** Sincronização bidirecional automática

---

## 📋 PRÉ-REQUISITOS

- ✅ Conta Google (Gmail)
- ✅ Acesso ao [Google Cloud Console](https://console.cloud.google.com)
- ✅ 15 minutos de tempo

---

## 🚀 PASSO A PASSO

### **PASSO 1: CRIAR PROJETO GOOGLE CLOUD** ⏱️ 2 min

1. **Aceder ao Google Cloud Console:**
   ```
   https://console.cloud.google.com
   ```

2. **Clicar no seletor de projetos** (topo esquerdo, ao lado de "Google Cloud")

3. **Clicar em "NOVO PROJETO"**

4. **Preencher:**
   ```
   Nome do projeto: Imogest CRM
   Organização: (deixar padrão)
   ```

5. **Clicar "CRIAR"**

6. **Aguardar criação** (≈30 segundos)

7. **Selecionar o projeto criado** no seletor de projetos

✅ **Confirmação:** Nome do projeto aparece no topo da página

---

### **PASSO 2: ATIVAR GOOGLE CALENDAR API** ⏱️ 1 min

1. **No menu lateral, clicar em:**
   ```
   APIs e Serviços → Biblioteca
   ```

2. **Na barra de pesquisa, digitar:**
   ```
   Google Calendar API
   ```

3. **Clicar no resultado** "Google Calendar API"

4. **Clicar no botão azul "ATIVAR"**

5. **Aguardar ativação** (≈10 segundos)

✅ **Confirmação:** Mensagem "API ativada" aparece

---

### **PASSO 3: CONFIGURAR TELA DE CONSENTIMENTO OAUTH** ⏱️ 5 min

#### **A. Criar Tela de Consentimento**

1. **No menu lateral, clicar em:**
   ```
   APIs e Serviços → Tela de consentimento OAuth
   ```

2. **Selecionar tipo de usuário:**
   ```
   ⚪ Interno  
   🔘 Externo ← Selecionar este
   ```

3. **Clicar "CRIAR"**

#### **B. Configurar Informações do App**

**Página 1: Informações do App**

```
Nome do app: Imogest CRM
Email de suporte: seu-email@gmail.com
Logo do app: (opcional)

Domínio da página inicial: https://seu-dominio.vercel.app
Política de Privacidade: (opcional)
Termos de Serviço: (opcional)

Email do desenvolvedor: seu-email@gmail.com
```

4. **Clicar "SALVAR E CONTINUAR"**

**Página 2: Escopos**

5. **Clicar "ADICIONAR OU REMOVER ESCOPOS"**

6. **Na barra de pesquisa, digitar:**
   ```
   calendar
   ```

7. **Selecionar o escopo:**
   ```
   ✅ https://www.googleapis.com/auth/calendar
   Descrição: Ver, editar, compartilhar e excluir permanentemente 
              todos os calendários que você pode acessar usando o 
              Google Agenda
   ```

8. **Clicar "ATUALIZAR"**

9. **Clicar "SALVAR E CONTINUAR"**

**Página 3: Usuários de Teste**

10. **Clicar "+ ADD USERS"**

11. **Adicionar emails dos utilizadores que vão testar:**
    ```
    seu-email@gmail.com
    email-teste@gmail.com
    (adicionar todos que vão usar)
    ```

12. **Clicar "ADICIONAR"**

13. **Clicar "SALVAR E CONTINUAR"**

**Página 4: Resumo**

14. **Revisar informações**

15. **Clicar "VOLTAR AO PAINEL"**

✅ **Confirmação:** Tela de consentimento configurada

---

### **PASSO 4: CRIAR CREDENCIAIS OAUTH 2.0** ⏱️ 3 min

1. **No menu lateral, clicar em:**
   ```
   APIs e Serviços → Credenciais
   ```

2. **Clicar no botão "+ CRIAR CREDENCIAIS"** (topo)

3. **Selecionar:**
   ```
   ID do cliente OAuth
   ```

4. **Preencher formulário:**
   ```
   Tipo de aplicativo: Aplicativo da Web
   Nome: Imogest CRM Web Client
   ```

5. **Em "URIs de redirecionamento autorizados", clicar "+ ADICIONAR URI"**

6. **Adicionar os seguintes URIs (um de cada vez):**
   ```
   https://3000-9d804bf8-0d80-4823-af0f-2c9bbddb5de7.softgen.dev/api/google-calendar/callback
   
   http://localhost:3000/api/google-calendar/callback
   ```

   ⚠️ **IMPORTANTE:** 
   - O primeiro URI é para o ambiente de desenvolvimento Softgen
   - O segundo é para testes locais (opcional)
   - Quando fizer deploy para produção, adicionar o URI do Vercel

7. **Clicar "CRIAR"**

8. **Modal aparece com suas credenciais:**

   ```
   ┌─────────────────────────────────────────────────────┐
   │ Cliente OAuth criado                                │
   ├─────────────────────────────────────────────────────┤
   │ ID do cliente:                                      │
   │ 123456789012-abc123def456.apps.googleusercontent.com│
   │                                                     │
   │ Chave secreta do cliente:                          │
   │ GOCSPX-abcdefghijklmnopqrstuvwxyz                  │
   └─────────────────────────────────────────────────────┘
   ```

9. **⚠️ IMPORTANTE: COPIAR E GUARDAR ESTAS CREDENCIAIS**
   - Clicar no ícone de copiar ao lado de cada credencial
   - Guardar num local seguro (vai precisar no próximo passo)

10. **Clicar "OK"**

✅ **Confirmação:** Credencial criada aparece na lista

---

### **PASSO 5: CONFIGURAR NO PROJETO** ⏱️ 2 min

1. **Abrir ficheiro `.env.local` no projeto**

2. **Localizar a secção Google Calendar** (no final do ficheiro)

3. **Descomentar as 3 linhas** (remover o `#` no início):
   ```env
   # DE:
   #NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
   #GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
   #NEXT_PUBLIC_GOOGLE_REDIRECT_URI=...
   
   # PARA:
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
   NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://3000-9d804bf8-0d80-4823-af0f-2c9bbddb5de7.softgen.dev/api/google-calendar/callback
   ```

4. **Substituir os valores:**
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-abc123def456.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
   NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://3000-9d804bf8-0d80-4823-af0f-2c9bbddb5de7.softgen.dev/api/google-calendar/callback
   ```

5. **Guardar ficheiro** (Ctrl+S)

6. **Reiniciar servidor:**
   ```bash
   pm2 restart all
   ```

✅ **Confirmação:** Servidor reiniciado com sucesso

---

### **PASSO 6: TESTAR INTEGRAÇÃO** ⏱️ 2 min

1. **Abrir navegador e ir para:**
   ```
   https://3000-9d804bf8-0d80-4823-af0f-2c9bbddb5de7.softgen.dev/calendar
   ```

2. **Verificar que aparece:**
   ```
   ✅ Botão "Conectar Google" visível
   ✅ Mensagem informativa DESAPARECEU
   ```

3. **Clicar "Conectar Google"**

4. **Fluxo OAuth esperado:**
   ```
   1. Redireciona para Google
   2. Escolher conta Google
   3. Tela: "Imogest CRM quer acessar sua Conta do Google"
   4. Clicar "Continuar"
   5. Tela: "Conceder acesso ao Imogest CRM"
   6. Verificar escopo: "Ver, editar, compartilhar e excluir todos os seus calendários"
   7. Clicar "Continuar"
   8. Redireciona de volta para o CRM
   ```

5. **Verificar que aparece:**
   ```
   ✅ Badge verde: "Google Calendar Conectado"
   ✅ Botão "Sincronizar" visível
   ```

6. **Clicar "Sincronizar"**

7. **Resultado esperado:**
   ```
   ✅ Eventos do Google Calendar importados
   ✅ Aparecem no calendário do CRM
   ✅ Mensagem de sucesso
   ```

8. **Criar evento no CRM:**
   - Clicar "Novo Evento"
   - Preencher dados
   - Salvar

9. **Clicar botão "📅" no evento criado**

10. **Verificar:**
    ```
    ✅ Evento exportado para Google Calendar
    ✅ Badge "Google" aparece no evento
    ✅ Evento visível no Google Calendar
    ```

---

## ✅ CHECKLIST FINAL

Antes de considerar a configuração completa, verificar:

```
□ Projeto Google Cloud criado
□ Google Calendar API ativada
□ Tela de consentimento OAuth configurada
□ Escopo calendar adicionado
□ Usuários de teste adicionados
□ Credenciais OAuth 2.0 criadas
□ URIs de redirecionamento configurados
□ Credenciais adicionadas ao .env.local
□ Servidor reiniciado
□ Botão "Conectar Google" visível
□ Fluxo OAuth funciona
□ Sincronização importa eventos
□ Exportação cria eventos no Google
```

---

## 🎉 PRONTO!

A integração Google Calendar está **100% configurada e funcional**!

**O que os utilizadores podem fazer agora:**

✅ **Sincronização Bidirecional:**
- Eventos do CRM → Google Calendar
- Eventos do Google Calendar → CRM

✅ **Funcionalidades Automáticas:**
- Importar todos os eventos com 1 clique
- Exportar eventos individuais
- Atualizar eventos sincronizados
- Ver status de sincronização

✅ **Para Toda a Equipa:**
- Cada utilizador conecta sua conta Google
- Sincronização individual e privada
- Sem interferência entre contas

---

## ⚙️ CONFIGURAÇÃO ADICIONAL (OPCIONAL)

### **Para Produção (Vercel Deploy)**

Quando fizer deploy para Vercel:

1. **Adicionar URI de produção no Google Cloud:**
   ```
   https://seu-dominio.vercel.app/api/google-calendar/callback
   ```

2. **Adicionar variáveis de ambiente no Vercel:**
   ```
   Settings → Environment Variables → Add New
   
   Nome: NEXT_PUBLIC_GOOGLE_CLIENT_ID
   Valor: [seu client ID]
   Ambientes: Production, Preview, Development
   
   Nome: GOOGLE_CLIENT_SECRET
   Valor: [seu secret]
   Ambientes: Production, Preview, Development
   
   Nome: NEXT_PUBLIC_GOOGLE_REDIRECT_URI
   Valor: https://seu-dominio.vercel.app/api/google-calendar/callback
   Ambientes: Production
   ```

3. **Redeploy projeto**

---

### **Publicar App (Remover "Modo de Teste")**

Por padrão, o app está em "Modo de Teste" (máximo 100 usuários de teste).

Para disponibilizar para todos:

1. **Google Cloud Console → APIs e Serviços → Tela de consentimento OAuth**

2. **Clicar "PUBLICAR APP"**

3. **Preencher formulário de verificação** (pode levar dias/semanas)

4. **Aguardar aprovação Google**

⚠️ **Nota:** Enquanto em modo de teste, funciona perfeitamente para usuários de teste adicionados.

---

## ⚠️ TROUBLESHOOTING

### **Erro: "Access blocked: This app's request is invalid"**

**Causa:** URI de redirecionamento não configurado corretamente

**Solução:**
1. Google Cloud Console → Credenciais
2. Editar credencial OAuth
3. Verificar URI está exatamente como no .env.local
4. Guardar e testar novamente

---

### **Erro: "Error 403: access_denied"**

**Causa:** Email não está em usuários de teste

**Solução:**
1. Google Cloud Console → Tela de consentimento OAuth
2. Adicionar email em "Usuários de teste"
3. Tentar conectar novamente

---

### **Erro: "invalid_client"**

**Causa:** Client ID ou Secret incorretos

**Solução:**
1. Verificar credenciais no .env.local
2. Comparar com Google Cloud Console
3. Copiar novamente se necessário
4. Reiniciar servidor

---

### **Eventos não sincronizam**

**Solução:**
1. Desconectar Google Calendar
2. Reconectar
3. Clicar "Sincronizar" novamente
4. Verificar permissões no Google

---

### **Botões Google não aparecem**

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
1. Verificar .env.local tem as 3 variáveis
2. Verificar não estão comentadas (#)
3. Verificar valores não são placeholders
4. Reiniciar servidor: `pm2 restart all`

---

## 📚 RECURSOS ADICIONAIS

- **Documentação Google Calendar API:**  
  https://developers.google.com/calendar/api/v3/reference

- **OAuth 2.0 Playground:**  
  https://developers.google.com/oauthplayground

- **Suporte Google Cloud:**  
  https://cloud.google.com/support

---

## 💡 DICAS PRO

1. **Adicionar múltiplos URIs de redirecionamento:**
   - Desenvolvimento: localhost:3000
   - Staging: staging.seu-dominio.com
   - Produção: seu-dominio.com

2. **Usar projetos separados:**
   - Desenvolvimento: "Imogest CRM Dev"
   - Produção: "Imogest CRM Prod"

3. **Monitorar uso da API:**
   - Google Cloud Console → APIs e Serviços → Dashboard
   - Ver quotas e limites

4. **Configurar alertas:**
   - Google Cloud Console → Monitoramento
   - Alertas de limite de API

---

## 📞 SUPORTE

Se encontrar problemas não listados aqui:

1. Verificar logs do servidor
2. Verificar console do navegador (F12)
3. Consultar documentação detalhada: `GOOGLE_CALENDAR_SETUP.md`
4. Contactar suporte técnico com:
   - Mensagem de erro exata
   - Passos para reproduzir
   - Screenshots (sem mostrar credenciais)

---

**Tempo total de configuração:** ~15 minutos  
**Resultado:** ✅ Integração Google Calendar 100% funcional  
**Próximo passo:** Começar a sincronizar eventos! 🚀