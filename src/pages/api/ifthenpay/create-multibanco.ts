import type { NextApiRequest, NextApiResponse } from "next";
import { ifthenpay } from "@/lib/ifthenpay";
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

    // O pagamento é sempre criado para o utilizador autenticado, nunca para
    // um userId indicado pelo chamador.
    const userId = user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: "planId é obrigatório" });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
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
    const payment = await ifthenpay.createMultibancoReference({
      amount: plan.price,
      reference,
      description: `Subscrição ${plan.name} - Vyxa One CRM`,
    });

    // Create pending payment record
    const { error } = await supabaseAdmin
      .from("payment_history")
      .insert({
        user_id: userId,
        amount: plan.price,
        currency: "EUR",
        status: "pending",
        payment_method: "multibanco",
        payment_reference: payment.reference,
        metadata: {
          plan_id: planId,
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
