# 🧪 Dev Tools - Ambiente de Testes

Esta pasta contém todas as ferramentas e scripts necessários para configurar e gerir o ambiente de testes do Imogest CRM.

---

## 📂 Estrutura

```
dev-tools/
├── README_AMBIENTE_TESTES.md       # Este ficheiro
├── AMBIENTE_TESTES_GUIA.md         # Guia completo do ambiente
├── SCRIPTS_NPM_INSTRUÇÕES.md       # Como adicionar scripts npm
├── production-schema.sql           # Schema completo da BD
├── test-data-seed.sql              # Dados de teste
└── clear-test-data.sql             # Limpar dados de teste
```

---

## 🗄️ Scripts SQL

### 1. `production-schema.sql`
**Propósito:** Criar toda a estrutura da base de dados

**Quando usar:**
- Primeira configuração da BD de testes
- Após fazer reset completo da BD
- Quando houver mudanças no schema de produção

**Como usar:**
1. Acede ao SQL Editor do Supabase
2. Copia todo o conteúdo de `production-schema.sql`
3. Cola e executa no SQL Editor
4. Aguarda confirmação de sucesso

**O que cria:**
- ✅ Todas as tabelas (leads, contacts, properties, etc.)
- ✅ Relações entre tabelas (foreign keys)
- ✅ Políticas RLS (Row Level Security)
- ✅ Triggers e funções
- ✅ Índices para performance

---

### 2. `test-data-seed.sql`
**Propósito:** Popular a BD com dados de teste realistas

**Quando usar:**
- Após criar o schema inicial
- Para ter dados imediatos para testar
- Quando precisas de resetar para dados conhecidos

**Como usar:**
1. **Certifica-te que o schema já existe** (executa `production-schema.sql` primeiro)
2. Acede ao SQL Editor
3. Copia todo o conteúdo de `test-data-seed.sql`
4. Cola e executa

**O que cria:**
- 👤 **3 usuários** de teste:
  - `admin@teste.pt` / `admin123` (Admin)
  - `agente@teste.pt` / `agente123` (Agente)
  - `cliente@teste.pt` / `cliente123` (Cliente)
- 🏠 **15 leads** em diferentes estados do pipeline
- 📞 **10 contactos** diversos
- 🏢 **8 propriedades** com detalhes completos
- 💬 **15 interações** (emails, chamadas, reuniões)
- ✅ **10 tarefas** atribuídas aos usuários
- 🔔 **5 notificações** de teste
- 📅 **5 eventos** no calendário

---

### 3. `clear-test-data.sql`
**Propósito:** Limpar todos os dados de teste (mantém o schema)

**Quando usar:**
- Quando quiseres começar do zero
- Antes de importar novos dados de teste
- Para limpar a BD sem destruir a estrutura

**Como usar:**
1. **⚠️ CUIDADO:** Isto apaga TODOS os dados!
2. Acede ao SQL Editor
3. Copia o conteúdo de `clear-test-data.sql`
4. Cola e executa
5. Opcionalmente, executa `test-data-seed.sql` para repopular

**O que faz:**
- 🗑️ Apaga todos os registos de todas as tabelas
- ✅ Mantém a estrutura (tabelas, colunas, relações)
- ✅ Mantém RLS e políticas
- ✅ Resets sequences (IDs começam do 1)

---

## 🔄 Workflows Comuns

### Setup Inicial da BD de Testes

```bash
# 1. No SQL Editor do Supabase
# Executa: production-schema.sql

# 2. (Opcional) Popular com dados
# Executa: test-data-seed.sql

# 3. Localmente
npm run dev
```

---

### Reset Completo

```bash
# 1. No SQL Editor
# Executa: clear-test-data.sql

# 2. Repopular (opcional)
# Executa: test-data-seed.sql

# 3. Limpar cache local
npm run clean
npm run dev
```

---

### Atualizar Schema (quando houver mudanças em produção)

```bash
# 1. Backup dos dados atuais (se necessário)
# No SQL Editor, exporta as tabelas importantes

# 2. No SQL Editor
# Executa: DROP SCHEMA public CASCADE;
# CREATE SCHEMA public;
# production-schema.sql

# 3. Restaurar dados se necessário
# Ou executar: test-data-seed.sql
```

---

## 📝 Documentação Adicional

### `AMBIENTE_TESTES_GUIA.md`
Guia completo e detalhado sobre:
- Como funciona o ambiente de testes
- Melhores práticas
- Troubleshooting
- Workflows de desenvolvimento

### `SCRIPTS_NPM_INSTRUÇÕES.md`
Como adicionar e usar scripts npm para:
- Trocar entre ambientes
- Verificar configuração
- Automatizar tarefas comuns

---

## 🆘 Troubleshooting

### ❌ Erro: "relation does not exist"
**Causa:** Schema não foi criado ou está incompleto
**Solução:** Executa `production-schema.sql` completo

### ❌ Erro: "duplicate key value"
**Causa:** Tentaste executar `test-data-seed.sql` duas vezes
**Solução:** Executa `clear-test-data.sql` primeiro

### ❌ Erro: "permission denied"
**Causa:** Políticas RLS podem estar bloqueando
**Solução:** Verifica se o usuário tem as permissões corretas

---

## 💡 Dicas

1. **Commits regulares**: Faz backup dos scripts SQL sempre que mudares a estrutura
2. **Documenta mudanças**: Se mudares o schema, atualiza `production-schema.sql`
3. **Dados realistas**: Usa dados que representem casos reais de uso
4. **Privacy first**: Nunca uses dados reais de clientes nos testes

---

## 📞 Suporte

Problemas com os scripts SQL?
1. Verifica os logs de erro do Supabase
2. Confirma que estás no projeto correto
3. Contacta a equipa de desenvolvimento

---

**Happy Testing! 🧪**