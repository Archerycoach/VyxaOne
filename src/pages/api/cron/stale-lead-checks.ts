import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

/**
 * Cron Job: Verificação de gatilhos de automação baseados em tempo
 *
 * Verifica diariamente três condições e dispara as automações
 * (Definições > Automação) configuradas para cada uma:
 *
 * - "no_contact_5_days"    → lead sem contacto há 5+ dias
 * - "no_activity_7_days"   → lead sem qualquer atividade há 7+ dias
 * - "stage_stale_10_days"  → lead parada há 10+ dias numa fase avançada do
 *                            pipeline (Contactado, Qualificado, Proposta ou
 *                            Negociação) sem avançar nem ser tocada
 *
 * Antes desta automação, estes gatilhos existiam no seletor mas nunca eram
 * verificados por nenhum cron — nunca disparavam.
 *
 * Usa workflow_trigger_log para nunca disparar a mesma automação, para a
 * mesma lead, mais do que uma vez para o mesmo estado — evita reenviar o
 * mesmo email/tarefa todos os dias enquanto a condição se mantiver.
 *
 * Configurado no vercel.json para executar diariamente.
 */

interface LeadRow {
  id: string;
  user_id: string;
  status: string | null;
  last_contact_date: string | null;
  updated_at: string | null;
  follow_up_state: string | null;
}

const STALE_ADVANCED_STAGES = ["contacted", "qualified", "proposal", "negotiation"];
const EXCLUDED_FOLLOW_UP_STATES = '("archived","opt_out")';

interface CheckResult {
  triggerType: string;
  checked: number;
  fired: number;
  skippedAlreadyFired: number;
  errors: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Stale Lead Checks] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Stale Lead Checks] Starting at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: CheckResult[] = [];

  try {
    // Só vale a pena verificar leads de utilizadores que têm pelo menos uma
    // automação ativa para algum destes três gatilhos.
    const { data: activeRules } = await supabaseAdmin
      .from("lead_workflow_rules")
      .select("user_id, trigger_status")
      .in("trigger_status", ["no_contact_5_days", "no_activity_7_days", "stage_stale_10_days"])
      .eq("enabled", true);

    const usersByTrigger = new Map<string, Set<string>>();
    for (const rule of (activeRules || []) as { user_id: string; trigger_status: string }[]) {
      if (!usersByTrigger.has(rule.trigger_status)) usersByTrigger.set(rule.trigger_status, new Set());
      usersByTrigger.get(rule.trigger_status)!.add(rule.user_id);
    }

    if (usersByTrigger.size === 0) {
      console.log("[Stale Lead Checks] Nenhuma automação ativa para estes gatilhos. A terminar.");
      return res.status(200).json({ success: true, message: "Sem automações ativas", results: [] });
    }

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const checks: { triggerType: string; matches: (lead: LeadRow) => boolean; trackedValueOf: (lead: LeadRow) => string }[] = [
      {
        triggerType: "no_contact_5_days",
        matches: (lead) => !lead.last_contact_date || lead.last_contact_date < fiveDaysAgo,
        trackedValueOf: (lead) => lead.last_contact_date || "never",
      },
      {
        triggerType: "no_activity_7_days",
        matches: (lead) => !lead.updated_at || lead.updated_at < sevenDaysAgo,
        trackedValueOf: (lead) => lead.updated_at || "never",
      },
      {
        triggerType: "stage_stale_10_days",
        matches: (lead) =>
          Boolean(lead.status) &&
          STALE_ADVANCED_STAGES.includes(lead.status as string) &&
          (!lead.updated_at || lead.updated_at < tenDaysAgo),
        trackedValueOf: (lead) => `${lead.status}:${lead.updated_at || "never"}`,
      },
    ];

    for (const check of checks) {
      const eligibleUserIds = Array.from(usersByTrigger.get(check.triggerType) || []);
      const checkResult: CheckResult = { triggerType: check.triggerType, checked: 0, fired: 0, skippedAlreadyFired: 0, errors: 0 };

      if (eligibleUserIds.length === 0) {
        results.push(checkResult);
        continue;
      }

      const { data: candidateLeads, error: leadsError } = await supabaseAdmin
        .from("leads")
        .select("id, user_id, status, last_contact_date, updated_at, follow_up_state")
        .in("user_id", eligibleUserIds)
        .not("follow_up_state", "in", EXCLUDED_FOLLOW_UP_STATES)
        .not("status", "in", '("won","lost")');

      if (leadsError) {
        console.error(`[Stale Lead Checks] Erro ao procurar leads para ${check.triggerType}:`, leadsError);
        checkResult.errors++;
        results.push(checkResult);
        continue;
      }

      const matchingLeads = (candidateLeads || []).filter((lead) => check.matches(lead as LeadRow));
      checkResult.checked = matchingLeads.length;

      for (const lead of matchingLeads as LeadRow[]) {
        try {
          const trackedValue = check.trackedValueOf(lead);

          const { data: existingLog } = await supabaseAdmin
            .from("workflow_trigger_log")
            .select("tracked_value")
            .eq("lead_id", lead.id)
            .eq("trigger_type", check.triggerType)
            .maybeSingle();

          if (existingLog && existingLog.tracked_value === trackedValue) {
            checkResult.skippedAlreadyFired++;
            continue;
          }

          // NOTA: cast necessário por um conflito de tipos genéricos entre
          // instâncias de SupabaseClient (mesmo package, geração de tipos
          // ligeiramente diferente) — o mesmo problema já existia dentro de
          // workflowEngine.ts (ver "const db = supabase as unknown as
          // SupabaseClient" em executeWorkflow), resolvido da mesma forma.
          const workflowResult = await runLeadWorkflows({
            supabase: supabaseAdmin as any,
            userId: lead.user_id,
            leadId: lead.id,
            triggerType: check.triggerType,
          });

          if (!workflowResult.success) {
            checkResult.errors++;
          }

          await supabaseAdmin.from("workflow_trigger_log").upsert(
            { lead_id: lead.id, trigger_type: check.triggerType, tracked_value: trackedValue, fired_at: now.toISOString() },
            { onConflict: "lead_id,trigger_type" }
          );

          checkResult.fired++;
        } catch (leadError) {
          console.error(`[Stale Lead Checks] Erro ao processar lead ${lead.id} (${check.triggerType}):`, leadError);
          checkResult.errors++;
        }
      }

      results.push(checkResult);
    }

    console.log("[Stale Lead Checks] Concluído:", JSON.stringify(results));
    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("[Stale Lead Checks] Erro:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
