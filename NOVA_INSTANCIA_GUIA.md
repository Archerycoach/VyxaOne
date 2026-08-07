# 🚀 Guia: Criar Nova Instância da Aplicação

Este guia explica como criar uma nova instância completa da aplicação (Vercel + Supabase) a partir do código existente.

---

## 📋 Pré-requisitos

- Conta no [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com)
- Repositório Git (GitHub, GitLab ou Bitbucket)
- Código da aplicação no repositório

---

## 🗄️ PARTE 1: Criar Nova Base de Dados no Supabase

### Passo 1: Criar Novo Projeto Supabase

1. Aceda a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **"New Project"**
3. Preencha os campos:
   - **Organization**: Escolha ou crie uma organização
   - **Project Name**: `imogest-producao` (ou outro nome)
   - **Database Password**: Crie uma password forte (GUARDE ESTA PASSWORD!)
   - **Region**: `Europe West (London)` ou `Europe Central (Frankfurt)` (mais próximo de Portugal)
   - **Pricing Plan**: Free ou Pro (conforme necessário)
4. Clique em **"Create new project"**
5. Aguarde 2-3 minutos enquanto o projeto é criado

### Passo 2: Obter Credenciais do Supabase

Após a criação do projeto:

1. No dashboard do Supabase, vá a **Settings** > **API**
2. **COPIE E GUARDE** estas informações:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave pública)
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave secreta - CUIDADO!)

### Passo 3: Criar a Estrutura da Base de Dados

Existem **3 opções** para criar as tabelas:

#### **OPÇÃO A: Usar Migrações (RECOMENDADO)**

1. No dashboard do Supabase, vá a **SQL Editor**
2. Abra a pasta `supabase/migrations/` do seu projeto local
3. **Execute as migrações por ordem cronológica** (dos ficheiros mais antigos para os mais recentes):
   - Abra cada ficheiro `.sql` na pasta `supabase/migrations/`
   - Copie o conteúdo SQL
   - Cole no SQL Editor do Supabase
   - Clique em **"Run"**
   - Repita para TODOS os ficheiros de migração

**NOTA IMPORTANTE**: Execute as migrações pela ordem dos timestamps nos nomes dos ficheiros:
- `20251227123119_migration_69d6ff01.sql` (primeiro)
- `20251227123129_migration_889b73a5.sql` (segundo)
- ... (continue em ordem)
- `20260113095801_migration_6f70c62f.sql` (último)

#### **OPÇÃO B: Script SQL Completo**

Se tiver um ficheiro SQL completo com toda a estrutura:

1. No dashboard do Supabase, vá a **SQL Editor**
2. Clique em **"New query"**
3. Cole o script SQL completo
4. Clique em **"Run"**

#### **OPÇÃO C: Clonar de Outro Projeto (Se Disponível)**

Se já tiver um projeto Supabase existente:

1. Use o Supabase CLI para fazer dump do schema:
```bash
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > schema.sql
```

2. Aplique ao novo projeto:
```bash
psql "postgresql://postgres:[NEW-PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" < schema.sql
```

### Passo 4: Configurar Row Level Security (RLS)

As migrações já incluem as políticas RLS, mas verifique:

1. No dashboard do Supabase, vá a **Authentication** > **Policies**
2. Verifique se todas as tabelas têm políticas configuradas
3. Se alguma tabela não tiver, adicione políticas básicas:

```sql
-- Exemplo de políticas básicas para a tabela 'leads'
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" ON leads
  FOR DELETE USING (auth.uid() = user_id);
```

### Passo 5: Configurar Autenticação

1. No dashboard do Supabase, vá a **Authentication** > **Providers**
2. Configure os provedores que pretende usar:
   - **Email**: Já vem ativado por padrão
   - **Google OAuth**: Se precisar (requer Client ID e Secret)
   - **Outros**: GitHub, Azure, etc.

3. Configure **URL Settings**:
   - Vá a **Authentication** > **URL Configuration**
   - **Site URL**: `https://seu-dominio.vercel.app` (preencha depois do deploy)
   - **Redirect URLs**: Adicione:
     - `https://seu-dominio.vercel.app/**`
     - `https://*.vercel.app/**` (para previews)
     - `http://localhost:3000/**` (para desenvolvimento)

### Passo 6: Configurar Storage (Se Usar Upload de Ficheiros)

1. No dashboard do Supabase, vá a **Storage**
2. Crie os buckets necessários:
   - Clique em **"Create a new bucket"**
   - **Name**: `lead-documents` (ou conforme definido na app)
   - **Public**: Marque se os ficheiros devem ser públicos
   - Clique em **"Create bucket"**

3. Configure as políticas de storage:
```sql
-- Exemplo: permitir upload apenas para utilizadores autenticados
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lead-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🚀 PARTE 2: Deploy no Vercel

### Passo 1: Preparar o Repositório Git

1. Certifique-se que o código está num repositório Git (GitHub, GitLab ou Bitbucket)
2. Faça commit de todas as alterações:
```bash
git add .
git commit -m "Preparar para deploy na nova instância"
git push origin main
```

### Passo 2: Criar Novo Projeto no Vercel

1. Aceda a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique em **"Add New..."** > **"Project"**
3. Selecione o seu repositório Git
4. Configure o projeto:
   - **Project Name**: `imogest-producao` (ou outro nome)
   - **Framework Preset**: Next.js (detectado automaticamente)
   - **Root Directory**: `./` (raiz do projeto)
   - **Build Command**: `npm run build` (padrão)
   - **Output Directory**: `.next` (padrão)

### Passo 3: Configurar Variáveis de Ambiente no Vercel

**CRÍTICO**: Configure TODAS as variáveis de ambiente antes do primeiro deploy!

1. No Vercel, na secção **"Environment Variables"**, adicione:

#### **Variáveis do Supabase (OBRIGATÓRIAS)**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Como obter SUPABASE_ACCESS_TOKEN**:
1. Vá a [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Clique em **"Generate new token"**
3. Nome: `vercel-deployment`
4. Copie o token gerado

#### **Variáveis de Pagamento (Se Usar Stripe/ifthenpay)**

**Stripe**:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

**ifthenpay** (uma chave por método — sem sandbox, ver CLAUDE.md):
```
IFTHENPAY_MBWAY_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
IFTHENPAY_MB_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
IFTHENPAY_CREDITCARD_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
IFTHENPAY_ANTIPHISHING_KEY=defines-tu-no-backoffice
```

#### **Variáveis do Google Calendar (Se Usar)**
```
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://seu-dominio.vercel.app/api/google-calendar/callback
```

#### **Variáveis de Email SMTP (Se Usar)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-app-password
```

#### **Outras Variáveis**
```
NEXTAUTH_URL=https://seu-dominio.vercel.app
NEXTAUTH_SECRET=gere-um-secret-aleatorio-aqui
NODE_ENV=production
```

**Como gerar NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

2. Para cada variável:
   - Cole o **Name** (nome da variável)
   - Cole o **Value** (valor da variável)
   - Marque **Production**, **Preview** e **Development**
   - Clique em **"Add"**

### Passo 4: Deploy

1. Depois de configurar todas as variáveis, clique em **"Deploy"**
2. Aguarde o build (3-5 minutos)
3. O Vercel vai:
   - Instalar dependências (`npm install`)
   - Executar build (`npm run build`)
   - Deploy para produção

### Passo 5: Configurar Domínio Personalizado (Opcional)

1. No projeto do Vercel, vá a **Settings** > **Domains**
2. Adicione o seu domínio:
   - Digite o domínio (ex: `app.imogest.pt`)
   - Siga as instruções para configurar DNS
3. Adicione o domínio às **Redirect URLs** do Supabase (ver Passo 5 da Parte 1)

---

## ✅ PARTE 3: Verificação Pós-Deploy

### Checklist de Verificação

Após o deploy, teste:

- [ ] **Autenticação**
  - [ ] Criar conta nova
  - [ ] Login com email/password
  - [ ] Recuperar password
  - [ ] Logout

- [ ] **Base de Dados**
  - [ ] Criar lead
  - [ ] Editar lead
  - [ ] Eliminar lead
  - [ ] Listar leads

- [ ] **Upload de Ficheiros** (se aplicável)
  - [ ] Upload de imagem/documento
  - [ ] Visualizar ficheiro
  - [ ] Eliminar ficheiro

- [ ] **Pagamentos** (se aplicável)
  - [ ] Criar checkout
  - [ ] Webhook funciona
  - [ ] Subscrição ativa

- [ ] **Integrações** (se aplicável)
  - [ ] Google Calendar sync
  - [ ] Email SMTP
  - [ ] WhatsApp (se configurado)

### Verificar Logs

1. **Vercel Logs**:
   - Vá a **Deployments** > clique no deploy > **Functions**
   - Verifique se há erros

2. **Supabase Logs**:
   - No dashboard do Supabase, vá a **Logs**
   - Verifique erros de autenticação, queries, etc.

---

## 🔧 Troubleshooting Comum

### Erro: "localStorage is not defined"
**Solução**: Já foi corrigido no código. Se ainda aparecer, verifique se o código está atualizado.

### Erro: "Supabase client not initialized"
**Solução**: Verifique se as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretas no Vercel.

### Erro: "Invalid JWT token"
**Solução**: Verifique se a `SUPABASE_SERVICE_ROLE_KEY` está correta e se o Supabase Access Token é válido.

### Erro 404 ao fazer login
**Solução**: Configure as **Redirect URLs** no Supabase (Parte 1, Passo 5).

### Webhooks não funcionam
**Solução**: 
1. Verifique se a URL do webhook está correta no Stripe/ifthenpay
2. URL deve ser: `https://seu-dominio.vercel.app/api/stripe/webhook` (ou `/api/ifthenpay/webhook`,
   registado no backoffice da ifthenpay por cada chave/método)

### Build falha no Vercel
**Soluções**:
1. Verifique os logs de build
2. Certifique-se que `package.json` está correto
3. Verifique se todas as dependências estão instaladas
4. Tente fazer build local: `npm run build`

---

## 📚 Recursos Úteis

- **Documentação Supabase**: https://supabase.com/docs
- **Documentação Vercel**: https://vercel.com/docs
- **Documentação Next.js**: https://nextjs.org/docs
- **Supabase CLI**: https://supabase.com/docs/guides/cli
- **Vercel CLI**: https://vercel.com/docs/cli

---

## 🔐 Segurança

### Boas Práticas

1. **NUNCA** commite chaves secretas no Git:
   - `.env.local` está no `.gitignore` por segurança
   - Use variáveis de ambiente no Vercel

2. **Passwords Fortes**:
   - Use passwords fortes para a BD Supabase
   - Use autenticação de 2 fatores (2FA) no Vercel e Supabase

3. **Limite de Rate**:
   - Configure rate limiting no Supabase
   - Use Vercel Edge Config para protecção adicional

4. **Backups**:
   - Configure backups automáticos no Supabase
   - Faça backups manuais antes de alterações grandes

5. **Monitorização**:
   - Configure alertas no Vercel para erros
   - Monitorize uso de recursos no Supabase

---

## 📞 Suporte

Se tiver problemas:

1. **Verificar logs**: Vercel Functions + Supabase Logs
2. **Documentação**: Consultar docs oficiais
3. **Community**: Supabase Discord / Vercel Discord
4. **Suporte**: Contactar suporte técnico se necessário

---

## ✨ Checklist Final

Antes de considerar a instância completa:

- [ ] Base de dados criada e estrutura importada
- [ ] RLS configurado e testado
- [ ] Autenticação funcionando
- [ ] Storage configurado (se necessário)
- [ ] Deploy no Vercel bem-sucedido
- [ ] Variáveis de ambiente configuradas
- [ ] Domínio personalizado configurado (opcional)
- [ ] Testes de funcionalidade completos
- [ ] Backups configurados
- [ ] Monitorização ativa

---

**🎉 Parabéns! A sua nova instância está pronta para usar!**

---

## 📦 **EXTRA: Exportar Estrutura da BD (Schema) SEM Dados**

Se já tem uma base de dados Supabase funcional e quer criar uma cópia **apenas da estrutura** (tabelas, colunas, tipos, funções, políticas RLS) **sem os dados dos utilizadores**, tem várias opções:

### **OPÇÃO 1: Usar Supabase CLI (RECOMENDADO)**

Esta é a forma mais limpa e profissional de exportar o schema.

#### **1.1. Instalar Supabase CLI**

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Ou via npm (qualquer SO)
npm install -g supabase
```

#### **1.2. Login no Supabase**

```bash
supabase login
```

Isto vai abrir o browser para autenticar.

#### **1.3. Link ao Projeto Existente**

```bash
# Na raiz do seu projeto
supabase link --project-ref SEU_PROJECT_REF
```

**Como encontrar o `project-ref`:**
- Vá ao dashboard do Supabase
- URL será: `https://supabase.com/dashboard/project/[SEU_PROJECT_REF]`
- Ou Settings → General → Reference ID

#### **1.4. Gerar Migrações do Estado Atual**

```bash
# Isto cria ficheiros SQL com TODO o schema atual
supabase db pull
```

**Resultado:**
- Cria ficheiros em `supabase/migrations/` com timestamp
- Inclui: tabelas, colunas, índices, funções, triggers, RLS policies
- **NÃO inclui dados** dos utilizadores

#### **1.5. Aplicar no Novo Projeto**

```bash
# Link ao NOVO projeto
supabase link --project-ref NOVO_PROJECT_REF

# Aplicar todas as migrações
supabase db push
```

---

### **OPÇÃO 2: Export via pg_dump (Schema Only)**

Se preferir usar PostgreSQL diretamente:

#### **2.1. Obter Connection String**

No Supabase Dashboard:
- **Settings** → **Database** → **Connection string** → **URI**
- Copie a connection string (formato: `postgresql://...`)

#### **2.2. Exportar Schema (sem dados)**

```bash
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  > schema_only.sql
```

**Flags importantes:**
- `--schema-only`: Apenas estrutura, sem dados
- `--no-owner`: Remove instruções de ownership
- `--no-privileges`: Remove instruções GRANT/REVOKE

#### **2.3. Limpar o Ficheiro (Opcional)**

Remova estas linhas do `schema_only.sql` se existirem:
```sql
-- Remover extensões que Supabase já tem
DROP EXTENSION IF EXISTS ...;
CREATE EXTENSION IF NOT EXISTS ...;

-- Remover schemas do sistema
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
```

#### **2.4. Importar no Novo Projeto**

```bash
psql "postgresql://postgres:[NEW_PASSWORD]@[NEW_HOST]:5432/postgres" \
  < schema_only.sql
```

---

### **OPÇÃO 3: Export Manual via Supabase Dashboard**

Método visual, bom para projetos pequenos:

#### **3.1. Exportar Schema de Cada Tabela**

1. Vá ao **Table Editor**
2. Para cada tabela, clique no menu (⋮) → **View SQL**
3. Copie o SQL de criação da tabela
4. Guarde num ficheiro `.sql`

#### **3.2. Exportar Políticas RLS**

1. Vá ao **Authentication** → **Policies**
2. Para cada tabela:
   - Copie o SQL de cada policy
   - Guarde junto com o schema da tabela

#### **3.3. Exportar Funções e Triggers**

1. Vá ao **Database** → **Functions**
2. Copie o código de cada função
3. Guarde num ficheiro separado

#### **3.4. Organizar Ficheiros**

Estrutura recomendada:
```
database-schema/
├── 01_tables.sql          # Criação de todas as tabelas
├── 02_rls_policies.sql    # Todas as políticas RLS
├── 03_functions.sql       # Funções personalizadas
├── 04_triggers.sql        # Triggers
└── 05_indexes.sql         # Índices adicionais
```

#### **3.5. Executar no Novo Projeto**

No **SQL Editor** do novo projeto Supabase:
1. Execute `01_tables.sql`
2. Execute `02_rls_policies.sql`
3. Execute `03_functions.sql`
4. Execute `04_triggers.sql`
5. Execute `05_indexes.sql`

---

### **OPÇÃO 4: Usar Ficheiros de Migração Existentes**

Se já tem o projeto organizado com migrações (como este projeto tem em `supabase/migrations/`):

#### **4.1. Copiar Ficheiros de Migração**

```bash
# Copie TODOS os ficheiros .sql de supabase/migrations/
cp -r supabase/migrations/* /caminho/para/novo/projeto/supabase/migrations/
```

#### **4.2. Aplicar no Novo Projeto**

```bash
cd /caminho/para/novo/projeto
supabase link --project-ref NOVO_PROJECT_REF
supabase db push
```

**Vantagem:**
- ✅ Mantém histórico completo de mudanças
- ✅ Fácil de versionar no Git
- ✅ Reproduzível em qualquer ambiente

---

### **⚠️ IMPORTANTE: O Que NÃO Será Exportado**

Nenhuma destas opções exporta:
- ❌ **Dados dos utilizadores** (registos nas tabelas)
- ❌ **Utilizadores do Auth** (emails, passwords)
- ❌ **Ficheiros do Storage** (imagens, PDFs, etc.)
- ❌ **Secrets** (API keys, tokens)

Se precisar migrar dados também, terá que fazer:
```bash
# Export COM dados
pg_dump "postgresql://..." > full_backup.sql

# Ou export selectivo de tabelas específicas
pg_dump "postgresql://..." -t users -t properties > data_backup.sql
```

---

### **🎯 Recomendação Final**

**Para este projeto especificamente:**

✅ **Use OPÇÃO 4** (Ficheiros de Migração Existentes):
- Já tem 200+ ficheiros de migração em `supabase/migrations/`
- Estão organizados cronologicamente
- Incluem TODO o schema necessário
- Basta copiar e executar `supabase db push`

Se quiser **uma versão "limpa"** sem histórico:
✅ **Use OPÇÃO 1** (Supabase CLI com `db pull`):
- Gera um ficheiro SQL limpo com estado atual
- Remove histórico de mudanças antigas
- Mais fácil de ler e manter

---

### **📝 Checklist de Exportação**

Antes de exportar, verifique se tem tudo:

- [ ] Schema de todas as tabelas
- [ ] Políticas RLS (Row Level Security)
- [ ] Índices personalizados
- [ ] Funções SQL personalizadas
- [ ] Triggers
- [ ] Tipos ENUM personalizados
- [ ] Foreign Keys e constraints
- [ ] Default values
- [ ] Comentários nas tabelas (opcional)

Depois de importar no novo projeto:

- [ ] Todas as tabelas existem
- [ ] RLS está ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Políticas RLS estão criadas
- [ ] Foreign Keys funcionam corretamente
- [ ] Funções e triggers estão operacionais
- [ ] Autenticação configurada (email, OAuth, etc.)
- [ ] Storage configurado (buckets e policies)

---
