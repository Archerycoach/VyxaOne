# 🎯 Guia Completo - Meta Lead Ads Integration

Este guia explica como configurar e usar a integração avançada com Meta Lead Ads (Facebook/Instagram) no Vyxa One CRM.

---

## 📚 **Índice**

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração Admin](#configuração-admin)
4. [Configuração Utilizador](#configuração-utilizador)
5. [Funcionalidades Avançadas](#funcionalidades-avançadas)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 **Visão Geral**

### **Funcionalidades Implementadas:**

✅ **1. Captura Automática via Webhook (Tempo Real)**
- Leads capturadas instantaneamente quando alguém preenche formulário
- Zero latência entre submissão e chegada ao CRM
- Email de notificação automático

✅ **2. Sincronização Manual/Retroativa**
- Buscar leads dos últimos X dias manualmente
- Importação inicial de leads antigas
- Botão de sync por formulário

✅ **3. Sincronização Agendada (Cron)**
- Edge Function executada a cada 1 hora
- Backup automático caso webhook falhe
- Processa todos os formulários com auto-import ativo

✅ **4. Mapeamento Personalizado de Campos**
- Configure campo a campo: Meta Form → CRM
- Campos customizados para cada formulário
- Priorização de mapeamentos

✅ **5. Gestão Multi-Formulários**
- Configure comportamento individual por formulário
- Auto-import on/off por formulário
- Notificações personalizadas

✅ **6. Histórico Completo**
- Tracking de todas as sincronizações
- Logs de sucesso/erro
- Auditoria de webhooks recebidos

---

## 🔧 **Pré-requisitos**

### **1. Meta for Developers**
- Conta no [Meta for Developers](https://developers.facebook.com/)
- App criada com permissões: `leads_retrieval`, `pages_manage_ads`, `pages_read_engagement`

### **2. Vyxa One CRM**
- Conta Admin para configuração inicial
- SMTP configurado (para notificações por email)

---

## ⚙️ **Configuração Admin**

### **Passo 1: Criar Meta App**

1. Aceda a [Meta for Developers](https://developers.facebook.com/)
2. Clique em **"My Apps"** → **"Create App"**
3. Escolha tipo: **"Business"**
4. Preencha:
   - **App Name:** "Vyxa CRM Integration"
   - **App Contact Email:** seu@email.com
5. Clique em **"Create App"**

### **Passo 2: Configurar Permissões**

1. No painel da App, vá em **"App Settings" → "Basic"**
2. Copie o **App ID** e **App Secret**
3. Vá em **"Use Cases" → "Customize"**
4. Adicione permissões:
   - ✅ `leads_retrieval`
   - ✅ `pages_manage_ads`
   - ✅ `pages_read_engagement`
5. Clique em **"Save Changes"**

### **Passo 3: Configurar no Vyxa CRM**

1. Aceda ao CRM: **Menu → Admin → Integrações**
2. Na secção **"Meta Lead Ads"**:
   - **App ID:** Cole o App ID da Meta
   - **App Secret:** Cole o App Secret
   - **Verify Token:** Clique em **"Gerar"** (gera automaticamente)
   - **Webhook URL:** Copie o URL gerado automaticamente
3. Ative o switch **"Ativar Integração Meta"**
4. Clique em **"Salvar Configurações"**

### **Passo 4: Configurar Webhook na Meta**

1. Volte ao painel da Meta App
2. Vá em **"Products" → "Webhooks"**
3. Clique em **"Configure Webhooks"**
4. Em **"Page"**, clique em **"Edit"**:
   - **Callback URL:** Cole o Webhook URL do CRM
   - **Verify Token:** Cole o token gerado no CRM
   - Clique em **"Verify and Save"**
5. Subscribe aos eventos:
   - ✅ `leadgen` (Lead Generation)
6. Clique em **"Save"**

### **Passo 5: Colocar App em Live Mode**

1. No painel da App, vá em **"App Mode"** (topo da página)
2. Mude de **"Development"** para **"Live"**
3. Complete o **"Data Use Checkup"** se solicitado
4. Clique em **"Switch Mode"**

✅ **Configuração Admin Completa!**

---

## 👤 **Configuração Utilizador**

### **Passo 1: Conectar Página Meta**

1. Aceda ao CRM: **Menu → Definições**
2. Procure a secção **"Meta Lead Ads"**
3. Clique em **"Conectar com Facebook"**
4. Será redirecionado para o Facebook:
   - Faça login (se necessário)
   - Selecione as **páginas** que deseja conectar
   - Clique em **"Continuar"** e **"Concluir"**
5. Volte automaticamente ao CRM

✅ **As suas páginas estão agora conectadas!**

### **Passo 2: Ver Páginas Conectadas**

Na secção **"Meta Lead Ads"**, verá:
- 📄 Lista de páginas conectadas
- ✅ Status: **Ativo** (webhook subscrito) ou **Inativo**
- 🗑️ Botão para desconectar página

### **Passo 3: Configurar Formulários**

1. **Selecione uma página** clicando nela
2. Aparecerá a secção **"Formulários - [Nome da Página]"**
3. Verá todos os formulários Meta dessa página:
   - Nome do formulário
   - Número de leads
   - Status (Ativo/Inativo)
   - Configurações aplicadas

4. **Para cada formulário**, clique no ícone ⚙️ **"Settings"**

### **Passo 4: Configuração Geral do Formulário**

Na aba **"Geral"**:

- ✅ **Importação Automática:** Ativa captura automática via webhook
- ✅ **Notificação por Email:** Recebe email quando lead chega
- 📝 **Origem da Lead:** Personalize (ex: "Meta - Campanha Verão 2026")
- 📊 **Fase Inicial do Pipeline:** Escolha onde a lead entra (Nova, Contactada, etc.)

### **Passo 5: Mapeamento de Campos (Opcional)**

Na aba **"Mapeamento"**:

1. Clique em **"Adicionar"**
2. Configure o mapeamento:
   - **Campo Meta:** Nome exato do campo no formulário (ex: `qual_o_seu_orcamento`)
   - **→ Campo CRM:** Para onde vai (ex: `Orçamento`)
3. Repita para cada campo customizado

**Campos Mapeados Automaticamente:**
- ✅ `full_name`, `name` → Nome
- ✅ `email` → Email
- ✅ `phone_number`, `phone` → Telefone

**Campos Extras sem Mapeamento:**
- Salvos automaticamente como **Nota** na lead

### **Passo 6: Ver Histórico de Sincronizações**

Na aba **"Histórico"**:

- 📅 Data e hora de cada sincronização
- 🔄 Tipo: Manual, Automática (webhook), Agendada (cron)
- ✅ Status: Sucesso, Erro, A correr
- 📊 Resultados: Leads criadas, duplicadas, erros

### **Passo 7: Sincronização Manual**

Para importar leads antigas:

1. Na lista de formulários, clique no ícone 🔄 **"Refresh"**
2. Ou, dentro das configurações, na aba **"Geral"**, configure dias retroativos
3. O sistema buscará leads dos últimos 7 dias (padrão)

✅ **Configuração Utilizador Completa!**

---

## 🚀 **Funcionalidades Avançadas**

### **1. Captura em Tempo Real (Webhook)**

**Como Funciona:**
```
Lead preenche formulário → Meta envia webhook → CRM recebe → Cria lead → Envia email
```

**Tempo de Latência:** < 5 segundos

**Dados Capturados:**
- ✅ Todos os campos do formulário
- ✅ ID da lead na Meta
- ✅ ID do formulário
- ✅ ID do anúncio (se disponível)
- ✅ Data/hora de criação

**Email de Notificação:**
```
🎯 Nova Lead da Meta!

Nome: João Silva
Email: joao@example.com
Telefone: +351912345678
Orçamento: 150.000€ - 200.000€
Localização: Baixa do Porto

[Ver Lead no CRM]
```

### **2. Sincronização Agendada (Cron Job)**

**Frequência:** A cada 1 hora (configurável)

**Funcionalidade:**
- Backup caso webhook falhe
- Garante que nenhuma lead se perde
- Processa apenas formulários com `auto_import = true`

**Edge Function:** `meta-leads-sync`

**Para Ativar:**
1. Vá em **Supabase Dashboard → Edge Functions**
2. Localize `meta-leads-sync`
3. Configure cron schedule: `0 * * * *` (a cada hora)

### **3. Sincronização Retroativa**

**Usar Para:**
- Importar leads antigas ao conectar pela primeira vez
- Recuperar leads perdidas
- Backup manual

**Como Fazer:**
1. Vá em **Definições → Meta Lead Ads**
2. Selecione a página e formulário
3. Clique no botão 🔄 ao lado do formulário
4. Sistema busca leads dos últimos 7 dias (personalizável no código)

**Limitações da Meta:**
- Máximo 90 dias retroativos
- Limite de 100 leads por request (paginação automática)

### **4. Mapeamento Personalizado**

**Exemplo Prático:**

**Formulário Meta:**
```
- qual_o_seu_orcamento: "150.000€ - 200.000€"
- bairro_de_interesse: "Baixa do Porto"
- tipo_de_imovel: "Apartamento T2"
- quantos_quartos: "2"
- quando_pretende_comprar: "Próximos 3 meses"
```

**Sem Mapeamento:**
→ Tudo vai para "Notas"

**Com Mapeamento:**
```
qual_o_seu_orcamento      → leads.budget
bairro_de_interesse       → leads.location_preference
tipo_de_imovel           → leads.property_type
quantos_quartos          → leads.notes (campo extra)
quando_pretende_comprar  → leads.notes (campo extra)
```

**Resultado na Lead:**
- **Orçamento:** 150.000€ - 200.000€
- **Localização:** Baixa do Porto
- **Tipo de Imóvel:** Apartamento T2
- **Notas:**
```
📝 Informações Adicionais:
• Quantos quartos: 2
• Quando pretende comprar: Próximos 3 meses
```

### **5. Multi-Formulários**

**Cenário:**
- Página A: 3 formulários (Compra, Venda, Arrendamento)
- Página B: 2 formulários (Investimento, Comercial)

**Configuração Individual:**

**Formulário "Compra":**
- ✅ Auto-import: Ativo
- ✅ Email: Ativo
- Origem: "Meta - Formulário Compra"
- Pipeline: "Nova"

**Formulário "Investimento":**
- ✅ Auto-import: Ativo
- ❌ Email: Inativo
- Origem: "Meta - Investidores"
- Pipeline: "Qualificada"

### **6. Logs e Auditoria**

**Tabelas de Logs:**

1. **`meta_sync_history`:**
   - Histórico de sincronizações
   - Status, data, resultados
   - Erros detalhados

2. **`meta_webhook_logs`:**
   - Todos os webhooks recebidos
   - Payload completo
   - Status de processamento

**Ver Logs no CRM:**
- Definições → Meta Lead Ads → Formulário → Aba "Histórico"

---

## 🐛 **Troubleshooting**

### **Problema: Leads não chegam ao CRM**

**Verificações:**

1. **Webhook configurado?**
   - Meta App → Webhooks → Verify "leadgen" está subscrito

2. **Integração ativa?**
   - Admin → Integrações → Meta → Switch ativo

3. **Página conectada?**
   - Definições → Meta Lead Ads → Ver páginas conectadas

4. **Formulário ativo?**
   - Ver configurações do formulário → Auto-import ativo

5. **Testar webhook:**
   - Meta App → Webhooks → Test Webhook → Enviar test leadgen event

**Ver Logs:**
```sql
SELECT * FROM meta_webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### **Problema: Email não é enviado**

**Verificações:**

1. **SMTP configurado?**
   - Definições → SMTP → Testar envio

2. **Email notification ativo no formulário?**
   - Configurações do formulário → Aba Geral → Switch "Notificação por Email"

3. **Email do utilizador está correto?**
   - Perfil → Verificar email

### **Problema: Campos do formulário não mapeados**

**Solução:**

1. Ver nome exato do campo na Meta:
   - Meta Ads Manager → Formulário → Ver campos

2. Criar mapeamento:
   - CRM → Configurações do formulário → Aba Mapeamento
   - Adicionar campo exato da Meta → Campo CRM

3. Ou deixar automático:
   - Campos extras vão para "Notas"

### **Problema: Token expirado**

**Sintoma:**
```
Error: Invalid OAuth access token
```

**Solução:**
1. Desconectar página
2. Reconectar página
3. Tokens são renovados automaticamente (60 dias)

### **Problema: Duplicação de leads**

**Causa:** Webhook + Cron sincronizando ao mesmo tempo

**Proteção Implementada:**
- Sistema verifica `meta_lead_id` antes de criar
- Leads duplicadas são automaticamente "skipped"

**Ver no histórico:**
```
Leads criadas: 5
Leads duplicadas: 2
```

---

## 📊 **Estatísticas e Monitorização**

### **Dashboard de Leads por Origem**

Ver quantas leads vieram da Meta:

```sql
SELECT 
  source,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted
FROM leads
WHERE source LIKE 'Meta%'
GROUP BY source;
```

### **Performance por Formulário**

```sql
SELECT 
  meta_form_id,
  COUNT(*) as total_leads,
  AVG(CASE WHEN budget IS NOT NULL THEN 1 ELSE 0 END) as budget_fill_rate
FROM leads
WHERE meta_form_id IS NOT NULL
GROUP BY meta_form_id;
```

---

## 🎓 **Boas Práticas**

### **1. Nomenclatura de Origens**
Use nomes descritivos:
- ✅ "Meta - Campanha Verão Porto"
- ✅ "Meta - Anúncio Investimento Lisboa"
- ❌ "Meta"
- ❌ "Facebook"

### **2. Mapeamento de Campos**
Mapeie apenas campos que usa regularmente:
- ✅ Orçamento → `budget`
- ✅ Localização → `location_preference`
- ❌ Cor favorita → deixar em Notas

### **3. Notificações por Email**
Active apenas para formulários importantes:
- ✅ Leads de compra → Email ON
- ❌ Newsletter signup → Email OFF

### **4. Sincronização Manual**
Use com moderação:
- ✅ Primeira conexão → Sync retroativo
- ✅ Recuperar leads perdidas → Sync manual
- ❌ Não fazer sync diário manualmente (use cron)

### **5. Monitorização**
Verifique semanalmente:
- 📊 Histórico de sincronizações
- 📝 Logs de webhooks
- ✅ Status de páginas conectadas

---

## 🔐 **Segurança**

### **Dados Protegidos:**
- ✅ Tokens encriptados no banco de dados
- ✅ RLS (Row Level Security) em todas as tabelas
- ✅ Cada utilizador vê apenas suas integrações
- ✅ Webhook verificado com Verify Token
- ✅ OAuth2 flow completo

### **Permissões Mínimas:**
A integração solicita apenas:
- `leads_retrieval` - Para buscar leads
- `pages_manage_ads` - Para subscrever webhooks
- `pages_read_engagement` - Para listar formulários

**Não temos acesso a:**
- ❌ Posts da página
- ❌ Mensagens privadas
- ❌ Dados de anúncios (exceto IDs)
- ❌ Billing/pagamentos

---

## 📞 **Suporte**

**Documentação Meta:**
- [Meta Lead Ads API](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)
- [Webhooks Reference](https://developers.facebook.com/docs/graph-api/webhooks/reference/leadgen)

**Suporte Vyxa:**
- Email: suporte@vyxa.pt
- Dentro do CRM: Menu → Suporte

---

## ✅ **Checklist de Configuração**

### **Admin:**
- [ ] Meta App criada
- [ ] Permissões configuradas
- [ ] App ID e Secret no CRM
- [ ] Webhook configurado na Meta
- [ ] App em Live Mode
- [ ] Integração ativa no CRM

### **Utilizador:**
- [ ] Página conectada
- [ ] Formulários listados
- [ ] Configurações por formulário definidas
- [ ] Mapeamento de campos (se necessário)
- [ ] Email de notificação testado
- [ ] Sync retroativo executado (primeira vez)

### **Opcional:**
- [ ] Edge Function cron agendado
- [ ] Dashboard de monitorização
- [ ] Alertas de falha configurados

---

**🎉 Integração Meta Lead Ads Completa e Funcional!**

Todas as leads dos seus formulários Facebook/Instagram serão automaticamente capturadas no Vyxa One CRM com notificações em tempo real.