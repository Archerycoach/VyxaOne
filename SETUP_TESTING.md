# 🧪 Setup do Ambiente de Testes - Guia Rápido

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Conta Supabase (já configurada)
- Git

---

## 🚀 Setup em 5 Minutos

### 1️⃣ Clone o Repositório
```bash
git clone https://github.com/Archerycoach/Imogest-Testes.git
cd Imogest-Testes
```

### 2️⃣ Instale as Dependências
```bash
npm install
```

### 3️⃣ Configure a Base de Dados (Primeira Vez)

Acede ao [SQL Editor do Supabase](https://supabase.com/dashboard/project/suckzuqzlemoyvyysfwg/sql) e executa:

**a) Schema completo (obrigatório)**
```sql
-- Copia e cola o conteúdo de: dev-tools/production-schema.sql
```

**b) Dados de teste (opcional mas recomendado)**
```sql
-- Copia e cola o conteúdo de: dev-tools/test-data-seed.sql
```

### 4️⃣ Verifica a Configuração
```bash
npm run env:check
```

Deves ver:
```
🔍 Ambiente Atual:
NEXT_PUBLIC_SUPABASE_URL=https://suckzuqzlemoyvyysfwg.supabase.co
```

### 5️⃣ Inicia o Servidor
```bash
npm run dev
```

Acede: **http://localhost:3000**

---

## 🔑 Login com Dados de Teste

```
👨‍💼 Admin
Email: admin@teste.pt
Password: admin123

👤 Agente
Email: agente@teste.pt
Password: agente123

👥 Cliente
Email: cliente@teste.pt
Password: cliente123
```

---

## 🛠️ Comandos Úteis

```bash
# Verificar ambiente
npm run env:check

# Limpar e reinstalar
npm run clean

# Ver instruções de BD
npm run db:schema   # Como aplicar schema
npm run db:seed     # Como adicionar dados
npm run db:clear    # Como limpar dados
```

---

## 🐛 Resolução de Problemas

### ❌ Erro: "Invalid API Key"
**Solução:** Verifica se o `.env.local` tem as chaves corretas:
```bash
cat .env.local | grep SUPABASE
```

### ❌ Erro: "Table does not exist"
**Solução:** Executa o schema SQL no Supabase:
```bash
npm run db:schema
# Depois copia dev-tools/production-schema.sql para o SQL Editor
```

### ❌ Erro: "No users found"
**Solução:** Adiciona dados de teste:
```bash
npm run db:seed
# Depois copia dev-tools/test-data-seed.sql para o SQL Editor
```

### ❌ Port 3000 já em uso
**Solução:**
```bash
# Mata o processo
lsof -ti:3000 | xargs kill -9

# Ou usa outra porta
PORT=3001 npm run dev
```

---

## 📊 Estrutura de Dados de Teste

Após executar `test-data-seed.sql`, terás:

- ✅ **3 usuários** (admin, agente, cliente)
- ✅ **15 leads** distribuídos por todos os estados
- ✅ **10 contactos** com diferentes tipos
- ✅ **8 propriedades** com detalhes completos
- ✅ **15 interações** (emails, chamadas, reuniões)
- ✅ **10 tarefas** atribuídas aos usuários
- ✅ **5 notificações** de teste
- ✅ **5 eventos** no calendário

---

## 🔄 Resetar Ambiente

Para começar do zero:

```bash
# 1. Limpa base de dados (no SQL Editor)
-- Executa: dev-tools/clear-test-data.sql

# 2. Reaplica schema
-- Executa: dev-tools/production-schema.sql

# 3. Adiciona dados novamente (opcional)
-- Executa: dev-tools/test-data-seed.sql

# 4. Limpa cache local
npm run clean
npm run dev
```

---

## 🎯 Próximos Passos

1. ✅ Explora o dashboard em `http://localhost:3000/dashboard`
2. ✅ Testa criar um lead novo
3. ✅ Testa o pipeline de vendas
4. ✅ Verifica o calendário e tarefas
5. ✅ Começa a desenvolver novas features!

---

## 📚 Documentação Completa

- [README Principal](README.md)
- [Guia de Ambiente de Testes](dev-tools/AMBIENTE_TESTES_GUIA.md)
- [Manual de Utilização](MANUAL_UTILIZACAO.md)

---

## 💡 Dicas

- 🔄 **Limpa dados regularmente** para manter ambiente limpo
- 📝 **Documenta bugs** encontrados durante testes
- 🚀 **Usa branches** para features experimentais
- 🔐 **NUNCA uses dados reais** neste ambiente

---

**Pronto para começar! 🎉**

Qualquer problema, consulta a documentação ou contacta o suporte.