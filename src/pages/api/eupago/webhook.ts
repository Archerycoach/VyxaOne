import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { referencia, valor, estado, identificador } = req.body;

  try {
    // 1. Find the payment in payment_history using the reference
    // We stored reference in provider_transaction_id or metadata
    // Using provider_transaction_id for lookup
    const { data: payment, error: fetchError } = await (supabase as any)
      .from("payment_history")
      .select("*")
      .eq("provider_transaction_id", referencia)
      .single();

    if (fetchError || !payment) {
      console.error("Payment not found:", fetchError);
      return res.status(404).json({ error: "Payment not found" });
    }

    if (estado === "PAGA") {
      // 2. Update payment status
      const updateData: any = {
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase as any)
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
        const { data: currentSub } = await (supabase as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", payment.user_id)
          .single();

        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1); // Default to monthly

        if (currentSub) {
          // Renew
          await (supabase as any)
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
          await (supabase as any)
            .from("subscriptions")
            .insert({
              user_id: payment.user_id,
              plan_id: planId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: nextMonth.toISOString(),
            });
        }
      }
    } else {
      // Update as failed or cancelled
      await (supabase as any)
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