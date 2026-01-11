# 🚀 Push para GitHub e Validação dos Ambientes

## 📋 Passo a Passo

### 1️⃣ **Fazer Push do Repositório de Testes**

```bash
# No terminal, no diretório do projeto atual
git push -u origin main
```

Se pedir autenticação, usa o teu **GitHub Personal Access Token**.

**Como criar um Personal Access Token:**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" → Seleciona "repo" (full control)
3. Copia o token gerado
4. Usa como password quando o Git pedir

---

### 2️⃣ **Validar que o Push Foi Bem-Sucedido**

**No Browser:**
1. Acede a: https://github.com/Archerycoach/Imogest-Testes
2. Verifica que aparecem os ficheiros:
   - ✅ README.md com título "🧪 Imogest - Ambiente de Testes"
   - ✅ Pasta `dev-tools/` com scripts SQL
   - ✅ `.github/` com templates
   - ✅ `CONTRIBUTING.md`, `SETUP_TESTING.md`

**No Terminal:**
```bash
# Verificar último commit no GitHub
git ls-remote origin main

# Deve mostrar o mesmo hash do commit local
```

---

### 3️⃣ **Validar que o Ambiente de Produção NÃO Foi Alterado**

#### A. **Verificar URL do Repositório Atual**

```bash
# Deve mostrar apenas o repositório de TESTES
git remote -v

# Resultado esperado:
# origin  https://github.com/Archerycoach/Imogest-Testes.git (fetch)
# origin  https://github.com/Archerycoach/Imogest-Testes.git (push)
```

#### B. **Verificar Credenciais da Base de Dados**

```bash
# Ver qual BD está configurada
cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL

# Deve mostrar:
# NEXT_PUBLIC_SUPABASE_URL=https://suckzuqzlemoyvyysfwg.supabase.co
# (BD de TESTES, não de produção)
```

#### C. **Verificar Repositório de Produção (se tiveres acesso)**

```bash
# Adicionar produção como remote (temporário, só para verificar)
git remote add production https://github.com/Archerycoach/imogest-old.git

# Ver último commit da produção
git fetch production
git log production/main --oneline -5

# IMPORTANTE: Os commits devem ser DIFERENTES dos commits de testes!
```

**No Browser (Repositório de Produção):**
1. Acede a: https://github.com/Archerycoach/imogest-old (se existir)
2. Verifica que:
   - ❌ NÃO tem "🧪 Ambiente de Testes" no README
   - ❌ NÃO tem pasta `dev-tools/` com dados de teste
   - ❌ NÃO tem `.env.local` com credenciais de testes
   - ✅ Mantém estrutura e commits originais

#### D. **Verificar que São Repositórios Diferentes**

```bash
# Comparar URLs
echo "=== REPOSITÓRIO ATUAL (TESTES) ==="
git remote get-url origin

echo ""
echo "=== REPOSITÓRIO DE PRODUÇÃO ==="
git remote get-url production 2>/dev/null || echo "Produção não configurada como remote"

# Devem ser URLs DIFERENTES!
```

---

### 4️⃣ **Verificar Isolamento dos Ambientes**

#### ✅ **Checklist de Validação:**

- [ ] **Repositórios Git separados**
  - Testes: `github.com/Archerycoach/Imogest-Testes`
  - Produção: `github.com/Archerycoach/imogest-old` (ou outro)

- [ ] **Bases de Dados separadas**
  - Testes: `suckzuqzlemoyvyysfwg.supabase.co`
  - Produção: (outra URL diferente)

- [ ] **Commits diferentes**
  - Testes: Inclui commits sobre "ambiente de testes"
  - Produção: Não tem esses commits

- [ ] **Documentação diferente**
  - Testes: README focado em testes
  - Produção: README focado no produto

- [ ] **Credenciais diferentes**
  - Testes: Chaves API de teste
  - Produção: Chaves API de produção

---

## 🎯 **Confirmação Final**

Execute este comando para gerar um relatório de validação:

```bash
echo "=== RELATÓRIO DE VALIDAÇÃO ==="
echo ""
echo "📍 Repositório Git Atual:"
git remote get-url origin
echo ""
echo "🗄️ Base de Dados Configurada:"
grep NEXT_PUBLIC_SUPABASE_URL .env.local
echo ""
echo "📝 Últimos 3 Commits:"
git log --oneline -3
echo ""
echo "✅ Se todas as informações acima mostram TESTES, está tudo correto!"
```

---

## ⚠️ **Se Algo Deu Errado**

### **Caso 1: Push foi para repositório errado**

```bash
# Ver para onde foi o push
git remote -v

# Se estiver errado, corrigir:
git remote set-url origin https://github.com/Archerycoach/Imogest-Testes.git

# Fazer push novamente
git push -u origin main --force
```

### **Caso 2: Produção foi alterada acidentalmente**

```bash
# CALMA! Git permite reverter
cd /caminho/para/repositorio/producao
git reflog  # Ver histórico de todas as operações
git reset --hard HEAD@{X}  # Voltar para commit anterior (onde X é o número)
git push origin main --force  # Restaurar no GitHub
```

### **Caso 3: Credenciais misturadas**

```bash
# Verificar qual .env está ativo
cat .env.local | head -5

# Se estiver errado, restaurar:
cp .env.local.testing .env.local  # Para testes
# OU
cp .env.local.production .env.local  # Para produção
```

---

## 📞 **Suporte**

Se encontrares problemas:

1. **NÃO ENTRES EM PÂNICO** - Git permite reverter tudo
2. **Tira screenshot** do erro
3. **Verifica os remotes**: `git remote -v`
4. **Contacta suporte** com os detalhes

---

## ✅ **Tudo Certo?**

Se completaste todos os passos acima e as validações passaram:

🎉 **Parabéns! Tens agora 2 ambientes completamente isolados:**

- 🏭 **Produção**: Dados reais, deploy ativo, usuários reais
- 🧪 **Testes**: Dados fictícios, desenvolvimento seguro, experimentação livre

Podes agora:
- Testar features arriscadas no ambiente de testes
- Fazer commits experimentais sem medo
- Desenvolver em segurança total
- Migrar features aprovadas para produção depois

---

**Última atualização**: 2026-01-01