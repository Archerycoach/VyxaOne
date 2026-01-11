# Regras do Projeto IMOGEST

## Regras Críticas de Desenvolvimento

### ⚠️ REGRA #1: PRESERVAÇÃO DE OPÇÕES EXISTENTES
**NUNCA ALTERAR AS OPÇÕES EXISTENTES**

Quando adicionar novas funcionalidades ou opções:
- ✅ **PERMITIDO**: Adicionar novas opções
- ✅ **PERMITIDO**: Adicionar novos campos opcionais
- ✅ **PERMITIDO**: Expandir funcionalidades existentes
- ❌ **PROIBIDO**: Remover opções existentes
- ❌ **PROIBIDO**: Modificar opções que já existem
- ❌ **PROIBIDO**: Alterar comportamento de funcionalidades em produção

**Áreas Afetadas:**
- Configurações de sistema (`system_settings`)
- Opções de formulários (dropdowns, selects, radio buttons)
- Campos de base de dados (sempre adicionar, nunca remover)
- Funcionalidades de UI/UX
- Integrações e APIs configuradas
- Workflows e automações

**Exemplo Correto:**
```typescript
// ✅ CORRETO: Adicionar nova opção
const leadTypes = ['hot', 'warm', 'cold', 'new_option'];

// ❌ ERRADO: Remover opção existente
// const leadTypes = ['hot', 'warm']; // 'cold' foi removido!
```

**Razão:**
Esta regra garante que:
1. Dados existentes continuam válidos
2. Workflows configurados não quebram
3. Usuários não perdem configurações
4. Sistema mantém retrocompatibilidade

---

## Regras de Migração de Base de Dados

### Adicionar Colunas
- Sempre adicionar colunas como `NULL` ou com `DEFAULT`
- Nunca adicionar colunas `NOT NULL` sem valor padrão

### Remover Colunas
- **NUNCA** remover colunas diretamente
- Marcar como deprecated primeiro
- Criar migração de dados antes de remover

### Alterar Tipos
- Sempre verificar compatibilidade com dados existentes
- Criar coluna nova se tipo for incompatível
- Migrar dados gradualmente

---

## Regras de Código

### TypeScript
- Tipos sempre explícitos para funções públicas
- Evitar `any` - usar `unknown` quando tipo não é conhecido
- Interfaces para objetos de dados, Types para uniões

### Nomenclatura
- Componentes: PascalCase (`LeadCard.tsx`)
- Funções/variáveis: camelCase (`getUserData`)
- Constantes: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- Ficheiros: kebab-case para utils (`date-utils.ts`)

### Serviços
- Um serviço por entidade/domínio
- Exportar apenas funções necessárias
- Manter funções focadas e pequenas (<50 linhas)

---

## Regras de Segurança

### RLS (Row Level Security)
- **SEMPRE** ativar RLS em tabelas com dados de utilizador
- Criar políticas específicas, nunca `true` para tudo
- Testar políticas com diferentes roles

### Autenticação
- Nunca expor tokens ou credenciais
- Sempre validar sessão no servidor
- Refresh tokens antes de expirar

### Dados Sensíveis
- Encriptar PII (Personally Identifiable Information)
- Nunca fazer log de passwords ou tokens
- Sanitizar inputs de utilizador

---

## Convenções de UI/UX

### Design System
- Usar componentes do shadcn/ui como base
- Manter consistência de cores via CSS variables
- Espaçamento em múltiplos de 4px

### Acessibilidade
- Contrastar mínimo WCAG AA (4.5:1)
- Labels em todos os inputs
- Suporte a teclado para navegação

### Responsividade
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Testar em múltiplos dispositivos

---

## Regras de Performance

### Queries
- Usar indices para colunas frequentemente consultadas
- Limitar resultados com `.limit()`
- Paginar listas grandes

### Frontend
- Lazy load de componentes pesados
- Debounce em inputs de pesquisa (300ms)
- Memoizar cálculos complexos

### Imagens
- Otimizar antes de upload
- Usar formatos modernos (WebP, AVIF)
- Lazy loading para imagens abaixo da dobra

---

## Controlo de Versões

### Commits
- Mensagens descritivas e concisas
- Prefixos: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `test:`
- Commits pequenos e focados

### Branches
- `main` - produção (protegida)
- `develop` - desenvolvimento
- `feature/nome` - novas funcionalidades
- `fix/nome` - correções

### Pull Requests
- Descrição clara do que foi alterado
- Screenshots para alterações visuais
- Testes passando antes de merge

---

**Última Atualização:** 2025-12-30
**Mantido por:** Equipa IMOGEST