import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

/**
 * Cron Job: Verificação de gatilhos de automação baseados em tempo
 *
 * Verifica diariamente três condições e dispara as automações
 * (Definições > Automação) configuradas para cada uma:
 *
 * - "no_contact_5_days"    → lead sem contacto há N+ dias (por defeito 5)
 * - "no_activity_7_days"   → lead sem qualquer atividade há N+ dias (por defeito 7)
 * - "stage_stale_10_days"  → lead parada há N+ dias numa fase avançada do
 *                            pipeline (Contactado, Qualificado, Proposta ou
 *                            Negociação) sem avançar nem ser tocada (por defeito 10)
 *
 * Cada uma destas automações é totalmente configurável pelo consultor, em
 * Definições > Automação > editar a automação:
 * - Quantos dias de inatividade antes do primeiro aviso (threshold_days)
 * - Quantas vezes avisar sobre a mesma lead (max_alerts, por defeito 1 —
 *   comportamento antigo, um único aviso)
 * - Frequência entre avisos repetidos, em dias (repeat_frequency_days)
 *
 * Se a lead voltar a ter atividade (o estado monitorizado muda) e depois
 * ficar parada outra vez, a contagem de avisos recomeça do zero.
 *
 * Antes desta automação, estes gatilhos existiam no seletor mas nunca eram
 * verificados por nenhum cron — nunca disparavam.
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

interface TriggerConfig {
  thresholdDays: number;
  maxAlerts: number;
  repeatFrequencyDays: number;
}

const STALE_ADVANCED_STAGES = ["contacted", "qualified", "proposal", "negotiation"];
const EXCLUDED_FOLLOW_UP_STATES = '("archived","opt_out")';

// Valores por defeito — usados quando o consultor não configurou nada de
// específico, para preservar exatamente o comportamento original.
const DEFAULT_THRESHOLDS: Record<string, number> = {
  no_contact_5_days: 5,
  no_activity_7_days: 7,
  stage_stale_10_days: 10,
};

interface CheckResult {
  triggerType: string;
  checked: number;
  fired: number;
  skippedAlreadyFired: number;
  errors: number;
}

function daysAgo(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
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
  const triggerTypes = Object.keys(DEFAULT_THRESHOLDS);

  try {
    // Só vale a pena verificar leads de utilizadores que têm pelo menos uma
    // automação ativa para algum destes três gatilhos — e vamos buscar já a
    // configuração de cada uma (dias/repetições/frequência).
    const { data: activeRules } = await supabaseAdmin
      .from("lead_workflow_rules")
      .select("user_id, trigger_status, action_config")
      .in("trigger_status", triggerTypes)
      .eq("enabled", true);

    // Por gatilho, mapa de utilizador -> configuração efetiva (com defeitos
    // aplicados a quem não personalizou nada).
    const configByTrigger = new Map<string, Map<string, TriggerConfig>>();
    for (const rule of (activeRules || []) as { user_id: string; trigger_status: string; action_config: any }[]) {
      if (!configByTrigger.has(rule.trigger_status)) configByTrigger.set(rule.trigger_status, new Map());
      const cfg = rule.action_config || {};
      const defaultThreshold = DEFAULT_THRESHOLDS[rule.trigger_status];
      configByTrigger.get(rule.trigger_status)!.set(rule.user_id, {
        thresholdDays: Number(cfg.threshold_days) > 0 ? Number(cfg.threshold_days) : defaultThreshold,
        maxAlerts: Number(cfg.max_alerts) > 0 ? Number(cfg.max_alerts) : 1,
        repeatFrequencyDays: Number(cfg.repeat_frequency_days) > 0 ? Number(cfg.repeat_frequency_days) : 3,
      });
    }

    if (configByTrigger.size === 0) {
      console.log("[Stale Lead Checks] Nenhuma automação ativa para estes gatilhos. A terminar.");
      return res.status(200).json({ success: true, message: "Sem automações ativas", results: [] });
    }

    const now = new Date();

    const matchersByTrigger: Record<string, { matches: (lead: LeadRow, cutoff: Date) => boolean; trackedValueOf: (lead: LeadRow) => string }> = {
      no_contact_5_days: {
        matches: (lead, cutoff) => !lead.last_contact_date || new Date(lead.last_contact_date) < cutoff,
        trackedValueOf: (lead) => lead.last_contact_date || "never",
      },
      no_activity_7_days: {
        matches: (lead, cutoff) => !lead.updated_at || new Date(lead.updated_at) < cutoff,
        trackedValueOf: (lead) => lead.updated_at || "never",
      },
      stage_stale_10_days: {
        matches: (lead, cutoff) =>
          Boolean(lead.status) &&
          STALE_ADVANCED_STAGES.includes(lead.status as string) &&
          (!lead.updated_at || new Date(lead.updated_at) < cutoff),
        trackedValueOf: (lead) => `${lead.status}:${lead.updated_at || "never"}`,
      },
    };

    for (const triggerType of triggerTypes) {
      const userConfigs = configByTrigger.get(triggerType);
      const checkResult: CheckResult = { triggerType, checked: 0, fired: 0, skippedAlreadyFired: 0, errors: 0 };

      if (!userConfigs || userConfigs.size === 0) {
        results.push(checkResult);
        continue;
      }

      const eligibleUserIds = Array.from(userConfigs.keys());
      const matcher = matchersByTrigger[triggerType];

      const { data: candidateLeads, error: leadsError } = await supabaseAdmin
        .from("leads")
        .select("id, user_id, status, last_contact_date, updated_at, follow_up_state")
        .in("user_id", eligibleUserIds)
        .not("follow_up_state", "in", EXCLUDED_FOLLOW_UP_STATES)
        .not("status", "in", '("won","lost")');

      if (leadsError) {
        console.error(`[Stale Lead Checks] Erro ao procurar leads para ${triggerType}:`, leadsError);
        checkResult.errors++;
        results.push(checkResult);
        continue;
      }

      // Cada lead usa o limiar de dias configurado pelo SEU consultor.
      const matchingLeads = ((candidateLeads || []) as LeadRow[]).filter((lead) => {
        const cfg = userConfigs.get(lead.user_id);
        if (!cfg) return false;
        return matcher.matches(lead, daysAgo(now, cfg.thresholdDays));
      });
      checkResult.checked = matchingLeads.length;

      for (const lead of matchingLeads) {
        try {
          const cfg = userConfigs.get(lead.user_id)!;
          const trackedValue = matcher.trackedValueOf(lead);

          const { data: existingLog } = await supabaseAdmin
            .from("workflow_trigger_log")
            .select("tracked_value, alert_count, fired_at")
            .eq("lead_id", lead.id)
            .eq("trigger_type", triggerType)
            .maybeSingle();

          let shouldFire = false;
          let nextAlertCount = 1;

          if (!existingLog) {
            // Primeira vez que esta lead entra neste estado — dispara.
            shouldFire = true;
            nextAlertCount = 1;
          } else if (existingLog.tracked_value !== trackedValue) {
            // O estado mudou desde o último aviso (ex.: houve um novo
            // contacto entretanto) — a lead voltou a ficar parada "de novo",
            // por isso a contagem de avisos recomeça.
            shouldFire = true;
            nextAlertCount = 1;
          } else {
            // Mesmo estado contínuo — só repete se ainda não atingiu o
            // número máximo de avisos E já passou tempo suficiente desde o
            // último aviso.
            const alertCount = existingLog.alert_count || 1;
            const daysSinceLastAlert = (now.getTime() - new Date(existingLog.fired_at).getTime()) / (24 * 60 * 60 * 1000);
            if (alertCount < cfg.maxAlerts && daysSinceLastAlert >= cfg.repeatFrequencyDays) {
              shouldFire = true;
              nextAlertCount = alertCount + 1;
            }
          }

          if (!shouldFire) {
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
            triggerType,
          });

          if (!workflowResult.success) {
            checkResult.errors++;
          }

          await supabaseAdmin.from("workflow_trigger_log").upsert(
            { lead_id: lead.id, trigger_type: triggerType, tracked_value: trackedValue, alert_count: nextAlertCount, fired_at: now.toISOString() },
            { onConflict: "lead_id,trigger_type" }
          );

          checkResult.fired++;
        } catch (leadError) {
          console.error(`[Stale Lead Checks] Erro ao processar lead ${lead.id} (${triggerType}):`, leadError);
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
