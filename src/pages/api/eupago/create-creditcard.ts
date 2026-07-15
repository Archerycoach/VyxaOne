import type { NextApiRequest, NextApiResponse } from "next";
import { eupago } from "@/lib/eupago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deriveAppUrl } from "@/lib/server/appUrl";

/**
 * Pagamento por cartão de crédito via EuPago (mesmo gateway do MBWay/Multibanco).
 * Devolve um `url` para onde o browser é encaminhado (formulário de cartão da
 * EuPago). A ativação da subscrição acontece no webhook /api/eupago/webhook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    const userId = user.id;
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ error: "planId é obrigatório" });
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (planError || !plan) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    const appUrl = deriveAppUrl(req);
    const reference = `SUB-${Date.now()}-${userId.slice(0, 8)}`;

    const payment = await eupago.createCreditCardPayment({
      amount: plan.price,
      reference,
      description: `Subscrição ${plan.name} - Vyxa One CRM`,
      successUrl: `${appUrl}/subscription?success=true`,
      failUrl: `${appUrl}/subscription?canceled=true`,
    });

    const { error } = await supabaseAdmin
      .from("payment_history")
      .insert({
        user_id: userId,
        amount: plan.price,
        currency: "EUR",
        status: "pending",
        payment_method: "card",
        payment_reference: payment.reference || reference,
        metadata: {
          plan_id: planId,
          ...payment,
        },
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error storing pending card payment:", error);
      return res.status(500).json({ error: "Erro ao armazenar pagamento pendente" });
    }

    return res.status(200).json({ success: true, url: payment.url });
  } catch (error: any) {
    console.error("Error creating credit card payment:", error);
    return res.status(500).json({ error: error.message || "Erro ao criar pagamento por cartão" });
  }
}
