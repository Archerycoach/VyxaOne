# 🤝 Guia de Contribuição - Ambiente de Testes

## 📋 Antes de Começar

Este é o **ambiente de testes** do Imogest CRM. Use-o para:
- ✅ Testar novas features antes de ir para produção
- ✅ Experimentar mudanças arriscadas
- ✅ Desenvolver em segurança com dados falsos
- ❌ **NÃO** usar com dados reais de clientes

---

## 🌿 Workflow de Desenvolvimento

### 1. Criar Nova Feature

```bash
# Atualizar repositório
git pull origin main

# Criar branch para a feature
git checkout -b feature/nome-da-feature

# Desenvolver e testar localmente
npm run dev
```

### 2. Testar as Mudanças

```bash
# Verificar erros
npm run lint

# Build de teste
npm run build

# Testar em produção local
npm run start
```

### 3. Commit e Push

```bash
# Adicionar ficheiros
git add .

# Commit com mensagem descritiva
git commit -m "feat: descrição clara da feature"

# Push para o repositório
git push origin feature/nome-da-feature
```

### 4. Pull Request

1. Vai ao GitHub
2. Cria Pull Request da tua branch para `main`
3. Descreve o que foi feito e porquê
4. Aguarda revisão

---

## 📝 Convenções de Commit

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: nova funcionalidade
fix: correção de bug
docs: mudanças na documentação
style: formatação, espaços, etc
refactor: reestruturação de código
test: adicionar testes
chore: mudanças de build, configs, etc
```

**Exemplos:**
```bash
git commit -m "feat: adicionar filtro de leads por data"
git commit -m "fix: corrigir erro no cálculo de comissões"
git commit -m "docs: atualizar README com novo setup"
```

---

## 🧪 Testar com Dados Reais (Cuidado!)

Se precisares testar com dados mais realistas:

```bash
# 1. Faz backup da tua BD de testes atual
# 2. No SQL Editor do Supabase, executa:
#    dev-tools/clear-test-data.sql
# 3. Importa os teus dados de teste
```

**⚠️ ATENÇÃO:**
- Usa sempre dados anonimizados
- Remove informações sensíveis (emails reais, telefones, etc)
- Não uses passwords reais

---

## 🐛 Reportar Bugs

### Template de Issue

```markdown
## 🐛 Descrição do Bug
[Descrição clara e concisa]

## 📋 Passos para Reproduzir
1. Vai para '...'
2. Clica em '...'
3. Vê o erro

## ✅ Comportamento Esperado
[O que deveria acontecer]

## ❌ Comportamento Atual
[O que está a acontecer]

## 📸 Screenshots
[Se aplicável]

## 🔧 Ambiente
- Browser: [Chrome/Firefox/Safari]
- Node.js: [versão]
- Sistema: [Windows/Mac/Linux]
```

---

## 🔄 Sincronizar com Produção

Para trazer mudanças aprovadas da produção para testes:

```bash
# Adicionar produção como remote
git remote add production https://github.com/Archerycoach/imogest-old.git

# Buscar mudanças
git fetch production

# Merge para testes
git checkout main
git merge production/main

# Resolver conflitos se necessário
# Depois fazer push
git push origin main
```

---

## ✅ Checklist Antes de Pull Request

- [ ] Código testado localmente
- [ ] Sem erros de lint (`npm run lint`)
- [ ] Build funciona (`npm run build`)
- [ ] Documentação atualizada se necessário
- [ ] Commit messages seguem convenção
- [ ] Dados de teste não foram comprometidos

---

## 🚀 Deploy (Opcional)

Se quiseres fazer deploy do ambiente de testes:

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurar variáveis de ambiente no dashboard
```

---

## 📞 Suporte

Problemas ou dúvidas?
- Abre uma Issue no GitHub
- Contacta a equipa de desenvolvimento

---

**Obrigado por contribuir! 🙏**