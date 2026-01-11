import Stripe from "stripe";

// Initialize Stripe with environment variable
const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.warn("STRIPE_SECRET_KEY not configured");
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
};

// Get publishable key for client-side
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
};

// Create a Stripe checkout session for subscription
export const createStripeCheckoutSession = async ({
  userId,
  planId,
  planName,
  amount,
  interval,
}: {
  userId: string;
  planId: string;
  planName: string;
  amount: number;
  interval: "month" | "year";
}) => {
  try {
    const stripe = getStripeClient();
    
    if (!stripe) {
      throw new Error("Stripe não está configurado. Configure STRIPE_SECRET_KEY no .env");
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=true`,
      metadata: {
        userId,
        planId,
      },
      subscription_data: {
        trial_period_days: 14,
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
    const stripe = getStripeClient();
    
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
  const stripe = getStripeClient();
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