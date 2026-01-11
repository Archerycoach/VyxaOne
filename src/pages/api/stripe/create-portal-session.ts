import type { NextApiRequest, NextApiResponse } from "next";
import { createStripeCustomer } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import Stripe from "stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get Stripe secret key from database
    const { data: integrationData } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_name", "stripe")
      .single();

    if (!integrationData) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const settings = integrationData.settings as any;

    const stripe = new Stripe(settings.secret_key, {
      apiVersion: "2025-02-24.acacia",
    });

    // Get customer ID from subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription`,
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: error.message });
  }
}