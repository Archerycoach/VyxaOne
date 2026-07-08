import type { NextApiRequest, NextApiResponse } from "next";
import { createStripeCheckoutSession } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    // A subscrição é sempre criada para o utilizador autenticado — nunca para
    // um userId indicado pelo chamador, para evitar criar/creditar sessões
    // de pagamento em nome de outra pessoa.
    const userId = user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: "planId é obrigatório" });
    }

    // Get plan details from Supabase
    const { data: plan, error: planError } = await supabaseAdmin
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