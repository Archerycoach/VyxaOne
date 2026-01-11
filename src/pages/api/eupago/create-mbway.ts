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
    const { userId, planId, phone } = req.body;

    if (!userId || !planId || !phone) {
      return res.status(400).json({ error: "userId, planId e phone são obrigatórios" });
    }

    // Validate Portuguese phone number
    const phoneRegex = /^(\+351|00351|351)?9[1236]\d{7}$/;
    const cleanPhone = phone.replace(/\s+/g, "");
    
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: "Número de telefone inválido. Use formato: +351 9XX XXX XXX" });
    }

    // Format phone number for Eupago (must be +351XXXXXXXXX)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith("+351")) {
      if (formattedPhone.startsWith("00351")) {
        formattedPhone = "+" + formattedPhone.slice(2);
      } else if (formattedPhone.startsWith("351")) {
        formattedPhone = "+" + formattedPhone;
      } else {
        formattedPhone = "+351" + formattedPhone;
      }
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

    // Create MBWay payment
    const payment = await eupago.createMBWayPayment({
      amount: plan.price,
      phone: formattedPhone,
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
        payment_method: "mbway",
        provider_transaction_id: payment.reference,
        metadata: {
          phone,
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
      transactionId: payment.transactionId,
      reference: payment.reference,
      message: "Pagamento MBWay iniciado. Por favor, confirme no seu telemóvel.",
    });
  } catch (error: any) {
    console.error("Error creating MBWay payment:", error);
    return res.status(500).json({ error: error.message || "Erro ao criar pagamento MBWay" });
  }
}