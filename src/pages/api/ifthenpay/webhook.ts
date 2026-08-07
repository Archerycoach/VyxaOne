import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyIfthenpayCallback } from "@/lib/ifthenpay";

/**
 * Callback da ifthenpay — GET com parâmetros na query string, não um POST
 * com corpo (diferença estrutural face à EuPago). Nomes confirmados no SDK
 * oficial (WebhookRequest::toArray()): val=montante, oid=orderId,
 * tid=transactionId, ref=referência, apk=chave anti-phishing.
 *
 * O URL de callback (com que a ifthenpay é configurada a chamar) regista-se
 * no backoffice da ifthenpay, por método de pagamento — ver checklist.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { val, oid, tid, ref, apk } = req.query as Record<string, string | undefined>;

  // Confirma que o pedido vem mesmo da ifthenpay (chave anti-phishing),
  // antes de confiar em qualquer campo do payload.
  const validSignature = await verifyIfthenpayCallback(apk).catch((error) => {
    console.error("[ifthenpay webhook] Falha a validar chave anti-phishing:", error);
    return false;
  });

  if (!validSignature) {
    console.error("[ifthenpay webhook] Chave anti-phishing inválida ou em falta");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  if (!oid) {
    return res.status(400).json({ error: "orderId (oid) em falta" });
  }

  try {
    const { data: payment, error: fetchError } = await (supabaseAdmin as any)
      .from("payment_history")
      .select("*")
      .eq("payment_reference", oid)
      .single();

    if (fetchError || !payment) {
      console.error("Payment not found:", oid, fetchError);
      return res.status(404).json({ error: "Payment not found" });
    }

    // A ifthenpay só chama o callback quando o pagamento está confirmado —
    // ao contrário da EuPago, não há um campo "estado" a distinguir
    // sucesso/falha no próprio callback. Chegar aqui com assinatura válida É
    // a confirmação.
    const updateData: any = {
      status: "completed",
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await (supabaseAdmin as any)
      .from("payment_history")
      .update(updateData)
      .eq("id", payment.id);

    if (updateError) throw updateError;

    console.log(`Payment confirmed for reference: ${oid} (transactionId: ${tid || "?"}, valor: ${val || "?"})`);

    // Se for pagamento de subscrição, ativa/renova a subscrição.
    const planId = (payment.metadata as any)?.plan_id;

    if (planId) {
      const { data: currentSub } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .single();

      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1); // Default to monthly

      if (currentSub) {
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: nextMonth.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("id", currentSub.id);
      } else {
        await (supabaseAdmin as any)
          .from("subscriptions")
          .insert({
            user_id: payment.user_id,
            plan_id: planId,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: nextMonth.toISOString(),
          });
      }

      // Sincronizar o perfil (que o SubscriptionGuard lê).
      await (supabaseAdmin as any)
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_plan: planId,
          subscription_end_date: nextMonth.toISOString(),
        })
        .eq("id", payment.user_id);
    }

    // A ifthenpay reenvia até 13 vezes se não receber 200 — devolver sempre
    // 200 depois de processado, mesmo que já estivesse "completed" antes
    // (idempotente), para não gerar reenvios desnecessários.
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
