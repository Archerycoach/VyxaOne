import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyEupagoWebhook, eupago } from "@/lib/eupago";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { referencia, valor, estado, identificador } = req.body;

  // Verify the request actually comes from EuPago (shared API key in payload),
  // instead of trusting the body blindly.
  if (!(await verifyEupagoWebhook(req.body, req.body?.chave))) {
    console.error("Eupago webhook: invalid or missing 'chave' in payload");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  try {
    // 1. Find the payment in payment_history using the reference
    // We stored reference in provider_transaction_id or metadata
    // Using provider_transaction_id for lookup
    const { data: payment, error: fetchError } = await (supabaseAdmin as any)
      .from("payment_history")
      .select("*")
      .eq("provider_transaction_id", referencia)
      .single();

    if (fetchError || !payment) {
      console.error("Payment not found:", fetchError);
      return res.status(404).json({ error: "Payment not found" });
    }

    // Re-confirm the payment status directly with EuPago's API rather than
    // trusting the "estado" field from the webhook body alone.
    const confirmedStatus = await eupago.checkPaymentStatus(referencia);
    if (estado === "PAGA" && !confirmedStatus.paid) {
      console.error("Eupago webhook: body claims PAGA but EuPago API disagrees", { referencia, confirmedStatus });
      return res.status(400).json({ error: "Payment status could not be confirmed" });
    }

    if (estado === "PAGA") {
      // 2. Update payment status
      const updateData: any = {
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabaseAdmin as any)
        .from("payment_history")
        .update(updateData)
        .eq("eupago_reference", referencia);

      if (updateError) throw updateError;
      
      // Log success (metadata removed)
      console.log(`Payment confirmed for reference: ${referencia}`);

      // 3. If it's a subscription payment, activate/renew subscription
      // We assume metadata contains plan_id if it was a subscription purchase
      const planId = (payment.metadata as any)?.plan_id;
      
      if (planId) {
        // Get user's current subscription
        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", payment.user_id)
          .single();

        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1); // Default to monthly

        if (currentSub) {
          // Renew
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
          // Create new
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
    } else {
      // Update as failed or cancelled
      await (supabaseAdmin as any)
        .from("payment_history")
        .update({ 
          status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("id", payment.id);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}