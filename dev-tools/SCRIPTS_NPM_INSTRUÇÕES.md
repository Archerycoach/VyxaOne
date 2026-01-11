# 📦 Scripts NPM para Ambiente de Testes

Este documento contém os scripts que devem ser adicionados ao `package.json` para facilitar o gerenciamento do ambiente de testes.

---

## 🔧 Instruções de Instalação

Abra o arquivo `package.json` e adicione os seguintes scripts na seção `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    
    "env:testing": "cp .env.local .env.local.backup && cp .env.local.testing .env.local && echo '✅ Ambiente de TESTES ativado'",
    "env:production": "cp .env.local .env.local.backup && cp .env.local.production .env.local && echo '✅ Ambiente de PRODUÇÃO ativado'",
    "env:dev": "cp .env.local.backup .env.local 2>/dev/null || echo '✅ Ambiente de DESENVOLVIMENTO ativado'",
    "env:check": "echo '📋 Ambiente atual:' && head -n 5 .env.local",
    
    "dev:testing": "npm run env:testing && npm run dev",
    "build:testing": "npm run env:testing && npm run build",
    
    "db:setup:testing": "echo '⚠️  Copie o conteúdo de database-schema.sql e execute no Supabase SQL Editor do projeto de TESTES'",
    "db:seed:testing": "echo '⚠️  Copie o conteúdo de test-data-seed.sql e execute no Supabase SQL Editor'",
    "db:clear:testing": "echo '⚠️  Copie o conteúdo de clear-test-data.sql e execute no Supabase SQL Editor'",
    "db:reset:testing": "echo '⚠️  Execute db:clear:testing e depois db:seed:testing manualmente no Supabase SQL Editor'"
  }
}
```

---

## 📚 Descrição dos Scripts

### **Gerenciamento de Ambiente**

#### `npm run env:testing`
Ativa o ambiente de **TESTES**:
- Faz backup do `.env.local` atual
- Copia `.env.local.testing` para `.env.local`
- Use antes de iniciar desenvolvimento em testes

#### `npm run env:production`
Ativa o ambiente de **PRODUÇÃO**:
- Faz backup do `.env.local` atual
- Copia `.env.local.production` para `.env.local`
- ⚠️ **CUIDADO**: Use apenas quando necessário!

#### `npm run env:dev`
Restaura o ambiente de **DESENVOLVIMENTO**:
- Restaura o backup anterior do `.env.local`
- Volta para o ambiente padrão de desenvolvimento

#### `npm run env:check`
Verifica qual ambiente está ativo:
- Mostra as primeiras 5 linhas do `.env.local`
- Útil para confirmar configuração antes de fazer alterações

---

### **Desenvolvimento com Testes**

#### `npm run dev:testing`
Inicia o servidor de desenvolvimento em modo de **TESTES**:
- Ativa automaticamente o ambiente de testes
- Inicia o Next.js em modo dev
- Perfeito para desenvolvimento iterativo

#### `npm run build:testing`
Faz build do projeto em modo de **TESTES**:
- Ativa o ambiente de testes
- Executa `next build`
- Útil para testar builds antes de deploy

---

### **Gerenciamento de Base de Dados**

#### `npm run db:setup:testing`
Instrução para aplicar o schema completo:
- Mostra mensagem para copiar `database-schema.sql`
- Deve ser executado no Supabase SQL Editor
- **Use apenas na primeira configuração**

#### `npm run db:seed:testing`
Instrução para popular com dados de teste:
- Mostra mensagem para copiar `test-data-seed.sql`
- Cria usuários, leads, contactos, propriedades, etc.
- Dados fictícios mas realistas

#### `npm run db:clear:testing`
Instrução para limpar dados de teste:
- ⚠️ **ATENÇÃO**: Remove TODOS os dados das tabelas!
- Mostra mensagem para copiar `clear-test-data.sql`
- Use apenas em ambiente de testes

#### `npm run db:reset:testing`
Instrução para reset completo:
- Combina `db:clear:testing` + `db:seed:testing`
- Limpa tudo e recarrega dados de teste
- Útil para começar do zero

---

## 🚀 Workflows Recomendados

### **Workflow 1: Primeira Configuração do Ambiente de Testes**

```bash
# 1. Configurar variáveis de ambiente
npm run env:testing

# 2. Aplicar schema da base de dados
npm run db:setup:testing
# (Copie o conteúdo de database-schema.sql e execute no Supabase SQL Editor)

# 3. Popular com dados de teste
npm run db:seed:testing
# (Copie o conteúdo de test-data-seed.sql e execute no Supabase SQL Editor)

# 4. Iniciar desenvolvimento
npm run dev
```

---

### **Workflow 2: Desenvolvimento Diário em Testes**

```bash
# Iniciar em modo de testes (ativa ambiente + inicia servidor)
npm run dev:testing

# Trabalhe normalmente...

# Se precisar resetar dados
npm run db:reset:testing
# (Execute os scripts manualmente no Supabase SQL Editor)
```

---

### **Workflow 3: Testar Nova Feature**

```bash
# 1. Ativar ambiente de testes
npm run env:testing

# 2. Limpar dados antigos
npm run db:clear:testing
# (Execute clear-test-data.sql no Supabase SQL Editor)

# 3. Popular com dados limpos
npm run db:seed:testing
# (Execute test-data-seed.sql no Supabase SQL Editor)

# 4. Desenvolver feature
npm run dev

# 5. Testar extensivamente

# 6. Quando satisfeito, voltar para desenvolvimento
npm run env:dev
```

---

### **Workflow 4: Preparar para Produção**

```bash
# 1. Testar em ambiente de testes
npm run env:testing
npm run build:testing

# 2. Se build passar, mudar para produção
npm run env:production
npm run build

# 3. Deploy
vercel --prod

# 4. Voltar para desenvolvimento
npm run env:dev
```

---

## ⚠️ Avisos Importantes

### **Segurança**
- ❌ **NUNCA** comite `.env.local` com credenciais reais
- ❌ **NUNCA** teste em produção
- ✅ **SEMPRE** use ambiente de testes para features experimentais
- ✅ **SEMPRE** confirme o ambiente antes de fazer alterações: `npm run env:check`

### **Backups**
- Os scripts `env:*` criam automaticamente `.env.local.backup`
- Se algo der errado: `cp .env.local.backup .env.local`
- Faça backup manual antes de mudanças grandes

### **Base de Dados**
- Scripts de DB são **instruções**, não executam automaticamente
- Você deve copiar o SQL e executar manualmente no Supabase
- Isso é intencional para segurança (evita acidentes em produção)

---

## 🆘 Troubleshooting

### Problema: Scripts não funcionam no Windows
**Solução**: Use Git Bash ou WSL, ou substitua os comandos:
```bash
# Windows (PowerShell)
Copy-Item .env.local .env.local.backup
Copy-Item .env.local.testing .env.local
```

### Problema: "Permission denied"
**Solução**: Dê permissões de execução:
```bash
chmod +x .env.local.testing
```

### Problema: Não sei qual ambiente está ativo
**Solução**:
```bash
npm run env:check
```

### Problema: Ambiente errado após mudar
**Solução**: Reinicie o servidor Next.js:
```bash
# Ctrl+C para parar
npm run dev  # Reiniciar
```

---

## 📞 Suporte

Para mais informações, consulte:
- `AMBIENTE_TESTES_GUIA.md` - Guia completo do ambiente de testes
- `test-data-seed.sql` - Estrutura dos dados de teste
- `clear-test-data.sql` - Script de limpeza

---

**Última atualização**: 2026-01-01  
**Versão**: 1.0.0