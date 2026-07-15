import Stripe from "stripe";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

// Cliente Stripe com a chave secreta gerida em Admin › Definições de Pagamento
// (BD), com fallback para env. Assíncrono porque lê a config da BD.
const getStripeClient = async () => {
  const { stripeSecretKey } = await getPaymentConfig();

  if (!stripeSecretKey) {
    console.warn("Chave secreta do Stripe não configurada (Admin › Definições de Pagamento)");
    return null;
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
};

// Create a Stripe checkout session for subscription
export const createStripeCheckoutSession = async ({
  userId,
  planId,
  planName,
  amount,
  interval,
  appUrl,
}: {
  userId: string;
  planId: string;
  planName: string;
  amount: number;
  interval: "month" | "year";
  appUrl: string;
}) => {
  try {
    const stripe = await getStripeClient();

    if (!stripe) {
      throw new Error("Stripe não está configurado. Configure a chave em Admin › Definições de Pagamento.");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: planName,
              description: `Subscrição ${planName} - Vyxa One CRM`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
            recurring: {
              interval: interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/subscription?canceled=true`,
      metadata: {
        userId,
        planId,
      },
      // Sem trial no Stripe: o período de teste é gerido pela app (trial_ends_at
      // configurável). Quem subscreve começa uma subscrição paga de imediato.
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
    });

    return { sessionId: session.id, url: session.url };
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    throw new Error(`Erro ao criar sessão de pagamento: ${error.message}`);
  }
};

// Create a Stripe customer
export const createStripeCustomer = async ({
  email,
  name,
  userId,
}: {
  email: string;
  name: string;
  userId: string;
}) => {
  try {
    const stripe = await getStripeClient();

    if (!stripe) {
      throw new Error("Stripe não está configurado");
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    return customer;
  } catch (error: any) {
    console.error("Error creating Stripe customer:", error);
    throw new Error(`Erro ao criar cliente Stripe: ${error.message}`);
  }
};

// Verify Stripe webhook signature
export const verifyStripeWebhook = async (
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> => {
  const stripe = await getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!stripe || !webhookSecret) {
    throw new Error("Stripe webhook não configurado");
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: any) {
    console.error("Error verifying Stripe webhook:", error);
    throw new Error(`Webhook inválido: ${error.message}`);
  }
};