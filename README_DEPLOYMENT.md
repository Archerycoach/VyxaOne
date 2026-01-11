# 🚀 Guia de Deploy e Configuração - ImobiCRM

## 📋 Índice
- [Requisitos](#requisitos)
- [Configuração Supabase](#configuração-supabase)
- [Integrações Externas](#integrações-externas)
- [Deploy na Vercel](#deploy-na-vercel)
- [Monetização SaaS](#monetização-saas)

---

## ✅ Requisitos

- Node.js 18+ instalado
- Conta Supabase (gratuita)
- Conta Vercel (gratuita)
- Domínio próprio (opcional, mas recomendado para SaaS)

---

## 🗄️ Configuração Supabase

### 1. Criar Projeto Supabase
1. Aceder a [supabase.com](https://supabase.com)
2. Criar novo projeto
3. Guardar credenciais (URL + Anon Key)

### 2. Configurar Storage para Imagens
```sql
-- Criar bucket para imagens de imóveis
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true);

-- Permitir upload de imagens (RLS)
CREATE POLICY "Users can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view property images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

CREATE POLICY "Users can delete their property images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);
```

### 3. Configurar Autenticação
1. Ir a **Authentication > Providers**
2. Ativar **Email** provider
3. (Opcional) Configurar OAuth (Google, Microsoft, etc.)

### 4. Variáveis de Ambiente
Copiar `.env.local.example` para `.env.local` e preencher:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

---

## 🔌 Integrações Externas

### 📧 Resend (Email)
1. Criar conta em [resend.com](https://resend.com)
2. Gerar API Key
3. Adicionar ao `.env.local`:
```bash
RESEND_API_KEY=re_sua_chave
NEXT_PUBLIC_APP_URL=https://seudominio.com
```

**Uso no CRM:**
- Notificações por email
- Emails de boas-vindas
- Relatórios automáticos
- Recuperação de password

---

### 📱 WhatsApp Business API
1. Criar conta Business em [developers.facebook.com](https://developers.facebook.com/docs/whatsapp)
2. Configurar número de telefone
3. Obter Phone Number ID + Access Token
4. Adicionar ao `.env.local`:
```bash
NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID=seu-phone-id
WHATSAPP_ACCESS_TOKEN=seu-access-token
```

**Uso no CRM:**
- Enviar mensagens a leads
- Notificações de novas visitas
- Lembretes de tarefas

---

### 📅 Google Calendar API
1. Aceder a [console.cloud.google.com](https://console.cloud.google.com)
2. Criar novo projeto
3. Ativar **Google Calendar API**
4. Criar credenciais OAuth 2.0
5. Adicionar ao `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=sua-api-key
```

**Configurar Redirect URIs:**
- `http://localhost:3000` (desenvolvimento)
- `https://seudominio.com` (produção)

**Uso no CRM:**
- Sincronização bidirecional de eventos
- Criação automática de eventos
- Notificações de agenda

---

### 🗺️ Mapbox (Mapas)
1. Criar conta em [mapbox.com](https://account.mapbox.com/)
2. Gerar Access Token
3. Adicionar ao `.env.local`:
```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.seu_token_mapbox
```

**Uso no CRM:**
- Mapa interativo de imóveis
- Geolocalização automática
- Visualização de zonas

---

## 🌐 Deploy na Vercel

### 1. Preparação
```bash
# Instalar dependências
npm install

# Build local para testar
npm run build
npm start
```

### 2. Deploy
```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Deploy
vercel --prod
```

**OU via Interface Web:**
1. Aceder a [vercel.com](https://vercel.com)
2. Importar repositório GitHub
3. Configurar variáveis de ambiente
4. Deploy automático

### 3. Conectar Domínio Próprio
1. Na Vercel: **Settings > Domains**
2. Adicionar domínio (ex: `app.suaempresa.com`)
3. Configurar DNS conforme instruções
4. Aguardar propagação (até 48h)

### 4. Configurar Variáveis de Ambiente na Vercel
**Settings > Environment Variables:**
- Adicionar TODAS as variáveis do `.env.local`
- Fazer redeploy após adicionar variáveis

---

## 💰 Monetização SaaS

### Modelo de Negócio Sugerido

#### 📊 Planos de Preços (Exemplo)
```
🆓 FREE (Sempre Gratuito)
- 1 utilizador
- 50 leads/mês
- 20 imóveis
- Funcionalidades básicas

💼 PROFISSIONAL (€29/mês)
- 3 utilizadores
- Leads ilimitados
- 200 imóveis
- Google Calendar sync
- WhatsApp integration
- Suporte por email

🏢 EMPRESARIAL (€99/mês)
- 10 utilizadores
- Leads ilimitados
- Imóveis ilimitados
- Todas as integrações
- API access
- Suporte prioritário
- Relatórios avançados
```

### 🔐 Implementar Pagamentos (Stripe)

**1. Instalar Stripe:**
```bash
npm install @stripe/stripe-js stripe
```

**2. Criar produtos no Stripe:**
- Aceder a [dashboard.stripe.com](https://dashboard.stripe.com)
- Criar produtos para cada plano
- Obter Product IDs

**3. Implementar Checkout:**
```typescript
// src/services/stripeService.ts
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);

export const createCheckoutSession = async (priceId: string) => {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });
  
  const session = await response.json();
  const stripe = await stripePromise;
  await stripe?.redirectToCheckout({ sessionId: session.id });
};
```

**4. Webhook para ativar subscrições:**
```typescript
// src/pages/api/stripe-webhook.ts
export default async function handler(req, res) {
  // Verificar evento do Stripe
  // Atualizar subscription_status na tabela profiles
  // Ativar/desativar acesso baseado no pagamento
}
```

### 📈 Estratégias de Crescimento

1. **Freemium**: Oferecer plano gratuito limitado
2. **Trial**: 14 dias grátis em planos pagos
3. **Referral Program**: Descontos por indicações
4. **Anual com desconto**: 20% off em pagamento anual
5. **Add-ons**: SMS, mais utilizadores, white-label

### 🎯 Métricas a Acompanhar

- **MRR** (Monthly Recurring Revenue)
- **Churn Rate** (taxa de cancelamento)
- **CAC** (Customer Acquisition Cost)
- **LTV** (Lifetime Value)
- **Conversão Free → Paid**

---

## 🛡️ Segurança & Compliance

### RGPD (Regulamento Geral de Proteção de Dados)

1. **Política de Privacidade**: Criar página explicando uso de dados
2. **Termos de Serviço**: Definir regras de utilização
3. **Consentimento**: Checkbox no registo
4. **Exportação de Dados**: Permitir utilizadores exportarem dados
5. **Direito ao Esquecimento**: Botão para apagar conta

```typescript
// Exemplo de exportação de dados
export const exportUserData = async (userId: string) => {
  const leads = await supabase.from('leads').select('*').eq('created_by', userId);
  const properties = await supabase.from('properties').select('*').eq('created_by', userId);
  // ... exportar todas as tabelas
  return { leads, properties, ... };
};
```

---

## 📱 Marketing & Landing Page

### Landing Page Sugerida
```
/
├── Hero Section (problema + solução)
├── Features (funcionalidades principais)
├── Pricing (planos e preços)
├── Testimonials (depoimentos)
├── FAQ
└── CTA (Call-to-Action: "Começar Grátis")
```

**Criar com:**
- Next.js (mesma app)
- Tailwind CSS
- Framer Motion (animações)
- SEO otimizado

---

## 🎓 Recursos Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Resend Docs](https://resend.com/docs)

---

## 📞 Suporte

Para dúvidas sobre o código ou arquitetura:
- Revisar este README
- Consultar comentários no código
- Testar localmente antes de deploy

---

**Boa sorte com o seu SaaS! 🚀**

*O CRM está pronto para escalar e gerar receita recorrente.*