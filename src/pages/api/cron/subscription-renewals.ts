import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/server/webPush";

/**
 * Cron: renovações de subscrição (diário).
 *
 * 1. LEMBRETE: subscrições ativas que expiram nos próximos REMINDER_DAYS e com
 *    renovação automática ligada — avisa o utilizador (notificação + push) com
 *    link para renovar. Ao pagar, o webhook do EuPago estende a subscrição.
 * 2. EXPIRAÇÃO: subscrições ativas cujo período já terminou passam a "past_due"
 *    e o perfil a "expired" (o SubscriptionGuard bloqueia o acesso).
 *
 * NOTA: a cobrança automática de cartão (sem o cliente agir) exige tokenização
 * no EuPago — ponto de extensão futuro (coluna subscriptions.card_token).
 */

const REMINDER_DAYS = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const results = { reminders: 0, expired: 0, errors: 0 };

  try {
    const now = new Date();
    const soon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

    // ── 1. Lembretes de renovação ────────────────────────────────────────────
    const { data: expiring } = await admin
      .from("subscriptions")
      .select("id, user_id, current_period_start, current_period_end, auto_renew, renewal_reminder_sent_at")
      .eq("status", "active")
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", soon.toISOString());

    for (const sub of (expiring || []) as any[]) {
      try {
        if (sub.auto_renew === false) continue;

        // Não repetir o lembrete no mesmo período: só reenvia se ainda não foi
        // enviado neste ciclo (depois do início do período atual).
        const periodStart = sub.current_period_start ? new Date(sub.current_period_start).getTime() : 0;
        const lastSent = sub.renewal_reminder_sent_at ? new Date(sub.renewal_reminder_sent_at).getTime() : 0;
        if (lastSent && lastSent >= periodStart) continue;

        const end = new Date(sub.current_period_end);
        const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
        const dateStr = end.toLocaleDateString("pt-PT");

        await admin.from("notifications").insert({
          user_id: sub.user_id,
          title: "⏰ A sua subscrição vai renovar",
          message: `A subscrição renova a ${dateStr} (${daysLeft} dia${daysLeft === 1 ? "" : "s"}). Garanta o pagamento para não perder o acesso.`,
          data: { kind: "subscription_renewal", action_url: "/subscription" },
        });

        await sendPushToUser(admin, sub.user_id, {
          title: "⏰ Subscrição a renovar",
          body: `Renova a ${dateStr} — trate do pagamento para manter o acesso.`,
          url: "/subscription",
          tag: "subscription-renewal",
        });

        await admin.from("subscriptions").update({ renewal_reminder_sent_at: now.toISOString() }).eq("id", sub.id);
        results.reminders++;
      } catch (err) {
        console.error("[subscription-renewals] Erro no lembrete:", err);
        results.errors++;
      }
    }

    // ── 2. Expiração ─────────────────────────────────────────────────────────
    const { data: expired } = await admin
      .from("subscriptions")
      .select("id, user_id")
      .eq("status", "active")
      .lt("current_period_end", now.toISOString());

    for (const sub of (expired || []) as any[]) {
      try {
        await admin.from("subscriptions").update({ status: "past_due", updated_at: now.toISOString() }).eq("id", sub.id);
        await admin
          .from("profiles")
          .update({ subscription_status: "expired" })
          .eq("id", sub.user_id);

        await admin.from("notifications").insert({
          user_id: sub.user_id,
          title: "⚠️ Subscrição expirada",
          message: "A sua subscrição terminou. Renove para voltar a ter acesso completo.",
          data: { kind: "subscription_expired", action_url: "/subscription" },
        });
        await sendPushToUser(admin, sub.user_id, {
          title: "⚠️ Subscrição expirada",
          body: "Renove para voltar a ter acesso ao Vyxa.",
          url: "/subscription",
          tag: "subscription-expired",
        });
        results.expired++;
      } catch (err) {
        console.error("[subscription-renewals] Erro na expiração:", err);
        results.errors++;
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("[subscription-renewals] Erro fatal:", error);
    return res.status(500).json({ success: false, error: error.message, results });
  }
}
