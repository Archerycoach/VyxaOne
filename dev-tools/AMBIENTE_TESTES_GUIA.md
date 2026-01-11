# 🧪 Guia do Ambiente de Testes e Desenvolvimento

Este guia explica como configurar e usar um ambiente separado de testes/desenvolvimento para o projeto Imogest.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Configuração Inicial](#configuração-inicial)
3. [Estrutura de Ambientes](#estrutura-de-ambientes)
4. [Scripts Disponíveis](#scripts-disponíveis)
5. [Dados de Teste](#dados-de-teste)
6. [Boas Práticas](#boas-práticas)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### Por que um ambiente de testes separado?

- ✅ **Segurança**: Protege dados de produção
- ✅ **Liberdade**: Teste features sem medo de quebrar algo
- ✅ **Velocidade**: Iterate rapidamente sem impacto em usuários
- ✅ **Dados Realistas**: Use dados de teste que simulam cenários reais

### Arquitetura de Ambientes

```
┌─────────────────────────────────────────────┐
│  PRODUÇÃO (.env.local.production)           │
│  - Dados reais de clientes                  │
│  - Stripe modo produção                     │
│  - Supabase projeto principal               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  TESTES (.env.local.testing)                │
│  - Dados fictícios                          │
│  - Stripe modo teste                        │
│  - Supabase projeto separado                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  DESENVOLVIMENTO (.env.local)               │
│  - Ambiente local padrão                    │
│  - Configurações flexíveis                  │
└─────────────────────────────────────────────┘
```

---

## ⚙️ Configuração Inicial

### Passo 1: Criar Novo Projeto Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Clique em "New Project"
3. Configure:
   - **Name**: `imogest-testing` ou similar
   - **Database Password**: Gere uma senha segura
   - **Region**: Mesma região do projeto de produção
   - **Pricing Plan**: Free tier é suficiente para testes

### Passo 2: Obter Credenciais

1. No dashboard do novo projeto, vá para **Settings** → **API**
2. Copie:
   - **Project URL** (exemplo: `https://abc123xyz.supabase.co`)
   - **anon/public key** (começa com `eyJ...`)
3. Vá para **Settings** → **Database** e copie:
   - **Connection string** (para obter a senha do DB)

### Passo 3: Configurar `.env.local.testing`

Abra o arquivo `.env.local.testing` e substitua os valores:

```bash
# Supabase (NOVO PROJETO DE TESTES)
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (sua chave anon)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (sua service role key)
SUPABASE_DB_PASSWORD=sua_senha_db

# Site URL (local)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe (MANTER CHAVES DE TESTE)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Outros serviços (use credenciais de teste)
```

### Passo 4: Aplicar Schema da Base de Dados

Execute as migrações no novo projeto:

```bash
# Usar arquivo completo de schema
npm run db:setup:testing
```

Ou manualmente no Supabase SQL Editor:
1. Copie conteúdo de `database-schema.sql`
2. Cole no SQL Editor do projeto de testes
3. Execute

---

## 🗂️ Estrutura de Ambientes

### Arquivos de Configuração

```
.
├── .env.local                    # Desenvolvimento (padrão)
├── .env.local.production         # Produção (dados reais)
├── .env.local.testing            # Testes (dados fictícios)
├── database-schema.sql           # Schema completo da DB
├── test-data-seed.sql            # Dados de teste (seed)
└── clear-test-data.sql           # Limpar dados de teste
```

### Como Alternar Entre Ambientes

#### Opção 1: Renomear Arquivos (Manual)

```bash
# Mudar para TESTES
cp .env.local .env.local.backup
cp .env.local.testing .env.local
npm run dev

# Voltar para DESENVOLVIMENTO
cp .env.local.backup .env.local
npm run dev
```

#### Opção 2: Scripts NPM (Recomendado)

```bash
# Ambiente de TESTES
npm run env:testing
npm run dev

# Ambiente de PRODUÇÃO
npm run env:production
npm run dev

# Ambiente de DESENVOLVIMENTO
npm run env:dev
npm run dev
```

---

## 🛠️ Scripts Disponíveis

### Scripts de Ambiente

```bash
# Alternar para ambiente de testes
npm run env:testing

# Alternar para ambiente de produção
npm run env:production

# Alternar para ambiente de desenvolvimento
npm run env:dev
```

### Scripts de Base de Dados

```bash
# Aplicar schema completo (primeira vez)
npm run db:setup:testing

# Popular com dados de teste
npm run db:seed:testing

# Limpar dados de teste
npm run db:clear:testing

# Reset completo (limpar + popular)
npm run db:reset:testing
```

### Scripts de Desenvolvimento

```bash
# Iniciar em modo de testes
npm run dev:testing

# Build para testes
npm run build:testing
```

---

## 🎲 Dados de Teste

### Estrutura de Dados de Teste

O script `test-data-seed.sql` cria:

#### 👤 **Usuários (Profiles)**
- **Admin**: admin@teste.com / Admin123!
- **Gestor 1**: gestor1@teste.com / Gestor123!
- **Gestor 2**: gestor2@teste.com / Gestor123!

#### 🏢 **Leads** (10 exemplos)
- Variados status: novo, contactado, qualificado, proposta, ganho, perdido
- Diferentes fontes: website, referência, anúncio
- Scores de 1-10

#### 👥 **Contactos** (15 exemplos)
- Mix de compradores e vendedores
- Emails e telefones válidos
- Notas e preferências

#### 🏠 **Propriedades** (8 exemplos)
- Apartamentos, moradias, terrenos
- Preços: 150.000€ - 850.000€
- Localizações variadas em Portugal

#### 📅 **Interações** (20+ exemplos)
- Chamadas, emails, reuniões, WhatsApp
- Distribuídas entre leads e contactos
- Datas variadas (últimos 30 dias)

#### ✅ **Tarefas** (12 exemplos)
- Pendentes e completadas
- Prioridades variadas
- Diferentes tipos

### Carregar Dados de Teste

```bash
npm run db:seed:testing
```

Ou manualmente:
1. Abra Supabase SQL Editor
2. Copie conteúdo de `test-data-seed.sql`
3. Execute

### Limpar Dados de Teste

```bash
npm run db:clear:testing
```

⚠️ **ATENÇÃO**: Isso remove TODOS os dados das tabelas!

---

## ✅ Boas Práticas

### DO ✅

- ✅ **Sempre use ambiente de testes** para features experimentais
- ✅ **Mantenha dados de teste realistas** mas fictícios
- ✅ **Documente** mudanças importantes no schema
- ✅ **Teste fluxos completos** antes de ir para produção
- ✅ **Use Stripe em modo teste** (chaves `pk_test_` e `sk_test_`)
- ✅ **Faça backup** antes de mudanças grandes

### DON'T ❌

- ❌ **Nunca teste em produção** com dados reais
- ❌ **Nunca comite** `.env.local` com credenciais reais
- ❌ **Não misture** ambientes (teste em prod ou vice-versa)
- ❌ **Não use dados pessoais reais** no ambiente de testes
- ❌ **Não compartilhe** credenciais de produção

### Checklist de Segurança

Antes de fazer deploy ou mudanças importantes:

- [ ] Estou no ambiente correto?
- [ ] As credenciais estão corretas?
- [ ] Fiz backup dos dados importantes?
- [ ] Testei em ambiente de testes primeiro?
- [ ] Revisei o código para credenciais hardcoded?
- [ ] Os webhooks apontam para os endpoints corretos?

---

## 🐛 Troubleshooting

### Problema: "Invalid API key" ou erros de conexão

**Solução:**
1. Verifique se está usando o arquivo `.env.local` correto
2. Confirme que as credenciais estão atualizadas
3. Teste a conexão no Supabase Dashboard
4. Reinicie o servidor Next.js

```bash
npm run env:testing  # Garantir ambiente correto
rm -rf .next         # Limpar cache
npm run dev          # Reiniciar
```

### Problema: Dados não aparecem após seed

**Solução:**
1. Verifique se o schema foi aplicado primeiro
2. Confirme que está conectado ao projeto correto
3. Olhe os logs do SQL Editor para erros

```bash
npm run db:setup:testing  # Aplicar schema
npm run db:seed:testing   # Popular dados
```

### Problema: Erros de RLS (Row Level Security)

**Solução:**
1. Verifique se as policies foram criadas
2. Confirme que está autenticado
3. Use Service Role Key temporariamente para debug

```sql
-- Desabilitar RLS temporariamente (APENAS EM TESTES!)
ALTER TABLE nome_tabela DISABLE ROW LEVEL SECURITY;
```

### Problema: Stripe webhooks não funcionam localmente

**Solução:**
Use Stripe CLI para redirecionar webhooks:

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Problema: Conflitos entre ambientes

**Solução:**
```bash
# Verificar qual .env está ativo
cat .env.local | head -n 5

# Forçar ambiente específico
rm .env.local
npm run env:testing
npm run dev
```

---

## 📚 Recursos Adicionais

### Documentação Oficial

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Stripe Testing](https://stripe.com/docs/testing)

### Comandos Úteis

```bash
# Ver ambiente atual
npm run env:check

# Backup completo da DB
npm run db:backup

# Logs do servidor
npm run dev -- --verbose

# Limpar tudo e recomeçar
npm run clean
npm run db:reset:testing
npm run dev:testing
```

---

## 🎓 Workflow Recomendado

### Para Desenvolver Nova Feature

1. **Setup**
   ```bash
   npm run env:testing
   npm run db:reset:testing  # Dados limpos
   npm run dev
   ```

2. **Desenvolvimento**
   - Desenvolva a feature
   - Teste com dados de teste
   - Itere rapidamente

3. **Validação**
   - Teste todos os fluxos
   - Verifique edge cases
   - Documente mudanças

4. **Deploy**
   ```bash
   npm run env:production
   npm run build
   # Deploy para Vercel/produção
   ```

### Para Testar Bug de Produção

1. **Replicar em Testes**
   ```bash
   npm run env:testing
   npm run db:seed:testing
   npm run dev
   ```

2. **Reproduzir Bug**
   - Use dados similares aos de produção
   - Documente os passos

3. **Corrigir**
   - Implemente fix
   - Teste extensivamente

4. **Validar em Produção**
   - Faça backup
   - Aplique fix
   - Monitore

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique este guia primeiro
2. Consulte logs: `.next/server/app/logs/`
3. Teste em ambiente limpo: `npm run db:reset:testing`
4. Contate o time de desenvolvimento

---

## 🔗 Repositório Git

Este ambiente de testes tem o seu próprio repositório Git separado do ambiente de produção.

**Repositório:** https://github.com/Archerycoach/Imogest-Testes

### Benefícios da Separação

- ✅ **Isolamento completo**: Mudanças de teste não afetam produção
- ✅ **Histórico limpo**: Commits experimentais não poluem a produção
- ✅ **Deploy independente**: Podes fazer deploy de testes sem afetar users reais
- ✅ **Reversão fácil**: Podes destruir e recriar sem consequências

### Sincronização com Produção

Para trazer mudanças aprovadas da produção para testes:

```bash
# Adicionar produção como remote (fazer uma vez)
git remote add production https://github.com/Archerycoach/imogest-old.git

# Buscar e merge de mudanças
git fetch production
git merge production/main

# Resolver conflitos se necessário
git push origin main
```

---

**Última atualização**: 2026-01-01  
**Versão**: 1.0.0