import type { NextApiRequest, NextApiResponse } from "next";
import { createStripeCheckoutSession } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { userId, planId } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: "userId e planId são obrigatórios" });
    }

    // Get plan details from Supabase
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    // Determine interval based on plan name
    let interval: "month" | "year" = "month";
    if (plan.name.toLowerCase().includes("anual") || plan.name.toLowerCase().includes("ano")) {
      interval = "year";
    }

    // Create Stripe checkout session
    const session = await createStripeCheckoutSession({
      userId,
      planId,
      planName: plan.name,
      amount: plan.price,
      interval,
    });

    return res.status(200).json(session);
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: error.message || "Erro ao criar sessão de pagamento" });
  }
}