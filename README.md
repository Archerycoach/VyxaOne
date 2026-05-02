# 🧪 Imogest - Ambiente de Testes

Este é o repositório de **testes e desenvolvimento** do Imogest CRM Imobiliário.

> ⚠️ **ATENÇÃO**: Este ambiente está conectado a uma base de dados de TESTES. Não usar em produção!

## 🚀 Setup Rápido

### 1. Instalar Dependências
```bash
npm install
```

### 2. Verificar Configuração
As credenciais de teste já estão configuradas em `.env.local`:
- Base de dados: `suckzuqzlemoyvyysfwg.supabase.co`
- Ambiente: **TESTES**

### 3. Iniciar Servidor
```bash
npm run dev
```

Acede em: `http://localhost:3000`

---

## 👤 Credenciais de Teste

### Usuários Pré-configurados
```
Admin:   admin@teste.pt   / admin123
Agente:  agente@teste.pt  / agente123
Cliente: cliente@teste.pt / cliente123
```

---

## 📊 Base de Dados de Testes

### Setup Inicial da BD
Se a base de dados estiver vazia, executa no SQL Editor do Supabase:

1. **Schema completo**: `dev-tools/production-schema.sql`
2. **Dados de teste**: `dev-tools/test-data-seed.sql` (opcional)

### Limpar Dados de Teste
```sql
-- Executa no SQL Editor
\i dev-tools/clear-test-data.sql
```

---

## 🛠️ Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Inicia servidor de produção
npm run lint         # Verifica código
npm run env:check    # Verifica qual ambiente está ativo
```

---

## 📂 Estrutura do Projeto

```
imogest-testes/
├── src/
│   ├── components/      # Componentes React
│   ├── pages/          # Páginas Next.js
│   ├── services/       # Serviços de API
│   ├── lib/            # Utilitários
│   └── integrations/   # Integrações (Supabase, etc)
├── dev-tools/          # Ferramentas de desenvolvimento
│   ├── production-schema.sql
│   ├── test-data-seed.sql
│   └── clear-test-data.sql
└── public/            # Assets estáticos
```

---

## 🔐 Segurança

- ✅ **RLS (Row Level Security)** ativo em todas as tabelas
- ✅ **Políticas de acesso** configuradas
- ✅ **Dados isolados** por usuário
- ✅ **Ambiente separado** da produção

---

## 📝 Dados de Teste Disponíveis

O ambiente de testes inclui:
- 👤 **3 usuários** (admin, agente, cliente)
- 🏠 **15 leads** em diferentes estados
- 📞 **10 contactos**
- 🏢 **8 propriedades**
- 💬 **15 interações**
- ✅ **10 tarefas**
- 🔔 **5 notificações**
- 📅 **5 eventos de calendário**

---

## 🧪 Como Testar Features Novas

1. **Cria uma branch** para a feature
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. **Desenvolve e testa** localmente

3. **Commit e push**
   ```bash
   git add .
   git commit -m "feat: descrição da feature"
   git push origin feature/nome-da-feature
   ```

4. **Cria Pull Request** no GitHub

5. **Após aprovação**, merge para `main`

---

## 🔄 Sincronização com Produção

Para atualizar este repositório com mudanças da produção:

```bash
# Adiciona produção como remote
git remote add production https://github.com/Archerycoach/imogest-old.git

# Puxa mudanças
git fetch production
git merge production/main

# Resolve conflitos se necessário
# Push para testes
git push origin main
```

---

## 📚 Documentação Adicional

- [Manual de Utilização](MANUAL_UTILIZACAO.md)
- [Guia de Deployment](DEPLOYMENT_GUIDE.md)
- [Setup Google Calendar](GOOGLE_CALENDAR_SETUP.md)
- [Ambiente de Testes](dev-tools/AMBIENTE_TESTES_GUIA.md)

---

## 🐛 Reportar Bugs

Para reportar bugs encontrados em testes:

1. Verifica se já existe issue no GitHub
2. Cria nova issue com:
   - Descrição do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots se relevante

---

## 🚀 Deploy (Opcional)

Este ambiente pode ser deployed em Vercel para testes remotos:

```bash
vercel --prod
```

Ou configura deploy automático no Vercel ligado a este repositório.

---

## ⚠️ Avisos Importantes

- 🚫 **NÃO usar dados reais** neste ambiente
- 🚫 **NÃO fazer deploy em produção** com estas credenciais
- ✅ **Sempre testar** antes de mover código para produção
- ✅ **Limpar dados de teste** regularmente

---

## 📞 Suporte

Para questões sobre o ambiente de testes, contacta a equipa de desenvolvimento.

---

**Happy Testing! 🧪**

**softgen-commit**