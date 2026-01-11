import type { NextApiRequest, NextApiResponse } from "next";
import { eupago } from "@/lib/eupago";
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

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    // Generate unique reference
    const reference = `SUB-${Date.now()}-${userId.slice(0, 8)}`;

    // Create Multibanco reference
    const payment = await eupago.createMultibancoReference({
      amount: plan.price,
      reference,
      description: `Subscrição ${plan.name} - Vyxa One CRM`,
    });

    // Create pending payment record
    const { data, error } = await supabase
      .from("payment_history")
      .insert({
        user_id: userId,
        amount: plan.price,
        currency: "EUR",
        status: "pending",
        payment_method: "multibanco",
        provider_transaction_id: payment.reference,
        metadata: {
          entidade: payment.entity,
          ...payment
        }
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error storing pending payment:", error);
      return res.status(500).json({ error: "Erro ao armazenar pagamento pendente" });
    }

    return res.status(200).json({
      success: true,
      entity: payment.entity,
      reference: payment.reference,
      amount: payment.amount,
      expiryDate: payment.expiryDate,
      message: "Referência Multibanco criada com sucesso",
    });
  } catch (error: any) {
    console.error("Error creating Multibanco reference:", error);
    return res.status(500).json({ error: error.message || "Erro ao criar referência Multibanco" });
  }
}