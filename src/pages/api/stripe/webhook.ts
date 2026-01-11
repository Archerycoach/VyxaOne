import type { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import { verifyStripeWebhook } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import Stripe from "stripe";

// Disable body parsing, need raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"];

    if (!sig || typeof sig !== "string") {
      return res.status(400).send("No signature");
    }

    // Verify webhook and get event
    const event = await verifyStripeWebhook(buf, sig);

    console.log("✅ Webhook verified, processing event:", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as any;
        await handleInvoicePaid(invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return res.status(400).json({ error: error.message });
  }
}

// Handle checkout session completed
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  if (!userId || !planId) {
    console.error("Missing metadata in checkout session");
    return;
  }

  console.log(`Checkout completed for user ${userId}, plan ${planId}`);
  
  // Subscription will be created by customer.subscription.created event
}

// Handle subscription created
async function handleSubscriptionCreated(subscription: any) {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId || !planId) {
    console.error("Missing metadata in subscription");
    return;
  }

  const startDate = new Date(subscription.current_period_start * 1000);
  const endDate = new Date(subscription.current_period_end * 1000);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  // Create subscription in Supabase
  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan_id: planId,
    status: subscription.status === "trialing" ? "trial" : "active",
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    trial_end_date: trialEnd?.toISOString(),
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    auto_renew: true,
  });

  if (error) {
    console.error("Error creating subscription:", error);
  } else {
    console.log(`Subscription created for user ${userId}`);
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription: any) {
  const endDate = new Date(subscription.current_period_end * 1000);
  
  // Map Stripe status to our DB status
  let status: "active" | "trialing" | "past_due" | "cancelled" | "unpaid" = "active";
  
  const stripeStatus = subscription.status;
  if (stripeStatus === "trialing") status = "trialing";
  else if (stripeStatus === "active") status = "active";
  else if (stripeStatus === "past_due") status = "past_due";
  else if (stripeStatus === "canceled") status = "cancelled";
  else if (stripeStatus === "unpaid") status = "unpaid";

  // Update subscription status
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    } as any)
    .eq("stripe_subscription_id", subscription.id);

  if (updateError) {
    console.error("Error updating subscription:", updateError);
  } else {
    console.log(`Subscription updated: ${subscription.id}`);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: any) {
  // Update subscription status to cancelled
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      auto_renew: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error cancelling subscription:", error);
  } else {
    console.log(`Subscription cancelled: ${subscription.id}`);
  }
}

// Handle invoice payment succeeded
async function handleInvoicePaid(invoice: any) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`);
  
  // Record payment in payment history
  if (invoice.subscription) {
    // Ensure subscription ID is a string
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (subscription) {
      await supabase.from("payment_history").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        amount: invoice.amount_paid / 100,
        status: "completed",
        payment_method: "stripe",
        transaction_id: invoice.id,
        payment_date: new Date().toISOString(),
        metadata: { invoice_id: invoice.id }
      });
    }
  }
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice: any) {
  console.log(`Payment failed for invoice: ${invoice.id}`);
  
  // Update subscription status if needed
  if (invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subscriptionId);
  }
}