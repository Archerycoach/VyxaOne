import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

/**
 * Cron Job: Programa de Pós-Venda
 *
 * Verifica diariamente leads com negócio fechado (status "won") e dispara
 * as automações (Definições > Automação) configuradas para:
 *
 * - "purchase_anniversary"        → aniversário da data de fecho do negócio
 *                                    (dispara todos os anos, nessa data)
 * - "referral_request_3_months"   → 3 meses após o fecho do negócio, pedido
 *                                    de indicação (dispara uma única vez)
 *
 * Usa leads.won_at (data estável, fixada uma única vez quando a lead passa
 * a "won" — ver src/services/leadsService.ts) como âncora, e
 * workflow_trigger_log para nunca repetir o mesmo disparo.
 *
 * Configurado no vercel.json para executar diariamente.
 */

interface WonLeadRow {
  id: string;
  user_id: string;
  won_at: string | null;
  follow_up_state: string | null;
}

const REFERRAL_REQUEST_DAYS = 90; // ~3 meses

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Post-Sale Checks] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Post-Sale Checks] Starting at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, { checked: number; fired: number; skippedAlreadyFired: number; errors: number }> = {
    purchase_anniversary: { checked: 0, fired: 0, skippedAlreadyFired: 0, errors: 0 },
    referral_request_3_months: { checked: 0, fired: 0, skippedAlreadyFired: 0, errors: 0 },
  };

  try {
    const { data: activeRules } = await supabaseAdmin
      .from("lead_workflow_rules")
      .select("user_id, trigger_status")
      .in("trigger_status", ["purchase_anniversary", "referral_request_3_months"])
      .eq("enabled", true);

    const usersByTrigger = new Map<string, Set<string>>();
    for (const rule of (activeRules || []) as { user_id: string; trigger_status: string }[]) {
      if (!usersByTrigger.has(rule.trigger_status)) usersByTrigger.set(rule.trigger_status, new Set());
      usersByTrigger.get(rule.trigger_status)!.add(rule.user_id);
    }

    if (usersByTrigger.size === 0) {
      console.log("[Post-Sale Checks] Nenhuma automação de pós-venda ativa. A terminar.");
      return res.status(200).json({ success: true, message: "Sem automações ativas", results });
    }

    const relevantUserIds = Array.from(new Set(Array.from(usersByTrigger.values()).flatMap((s) => Array.from(s))));

    const { data: wonLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, won_at, follow_up_state")
      .in("user_id", relevantUserIds)
      .eq("status", "won")
      .not("won_at", "is", null)
      .not("follow_up_state", "in", '("archived","opt_out")');

    if (leadsError) {
      console.error("[Post-Sale Checks] Erro ao procurar leads won:", leadsError);
      return res.status(500).json({ error: leadsError.message });
    }

    const now = new Date();

    for (const lead of (wonLeads || []) as WonLeadRow[]) {
      const wonAt = new Date(lead.won_at as string);

      // --- Aniversário da compra (recorrente, uma vez por ano) ---
      if (usersByTrigger.get("purchase_anniversary")?.has(lead.user_id)) {
        const isAnniversaryToday = now.getMonth() === wonAt.getMonth() && now.getDate() === wonAt.getDate() && now.getFullYear() > wonAt.getFullYear();

        if (isAnniversaryToday) {
          results.purchase_anniversary.checked++;
          const trackedValue = String(now.getFullYear());

          try {
            const { data: existingLog } = await supabaseAdmin
              .from("workflow_trigger_log")
              .select("tracked_value")
              .eq("lead_id", lead.id)
              .eq("trigger_type", "purchase_anniversary")
              .maybeSingle();

            if (existingLog && existingLog.tracked_value === trackedValue) {
              results.purchase_anniversary.skippedAlreadyFired++;
            } else {
              const workflowResult = await runLeadWorkflows({
                supabase: supabaseAdmin as any,
                userId: lead.user_id,
                leadId: lead.id,
                triggerType: "purchase_anniversary",
              });
              if (!workflowResult.success) results.purchase_anniversary.errors++;

              await supabaseAdmin.from("workflow_trigger_log").upsert(
                { lead_id: lead.id, trigger_type: "purchase_anniversary", tracked_value: trackedValue, fired_at: now.toISOString() },
                { onConflict: "lead_id,trigger_type" }
              );
              results.purchase_anniversary.fired++;
            }
          } catch (err) {
            console.error(`[Post-Sale Checks] Erro (purchase_anniversary) na lead ${lead.id}:`, err);
            results.purchase_anniversary.errors++;
          }
        }
      }

      // --- Pedido de indicação (uma única vez, ~3 meses depois) ---
      if (usersByTrigger.get("referral_request_3_months")?.has(lead.user_id)) {
        const daysSinceWon = Math.floor((now.getTime() - wonAt.getTime()) / (24 * 60 * 60 * 1000));

        if (daysSinceWon >= REFERRAL_REQUEST_DAYS) {
          results.referral_request_3_months.checked++;
          const trackedValue = "fired";

          try {
            const { data: existingLog } = await supabaseAdmin
              .from("workflow_trigger_log")
              .select("tracked_value")
              .eq("lead_id", lead.id)
              .eq("trigger_type", "referral_request_3_months")
              .maybeSingle();

            if (existingLog) {
              results.referral_request_3_months.skippedAlreadyFired++;
            } else {
              const workflowResult = await runLeadWorkflows({
                supabase: supabaseAdmin as any,
                userId: lead.user_id,
                leadId: lead.id,
                triggerType: "referral_request_3_months",
              });
              if (!workflowResult.success) results.referral_request_3_months.errors++;

              await supabaseAdmin.from("workflow_trigger_log").upsert(
                { lead_id: lead.id, trigger_type: "referral_request_3_months", tracked_value: trackedValue, fired_at: now.toISOString() },
                { onConflict: "lead_id,trigger_type" }
              );
              results.referral_request_3_months.fired++;
            }
          } catch (err) {
            console.error(`[Post-Sale Checks] Erro (referral_request_3_months) na lead ${lead.id}:`, err);
            results.referral_request_3_months.errors++;
          }
        }
      }
    }

    console.log("[Post-Sale Checks] Concluído:", JSON.stringify(results));
    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("[Post-Sale Checks] Erro:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
