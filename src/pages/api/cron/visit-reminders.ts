import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

/**
 * Cron Job: Lembrete de Visita Agendada
 *
 * Verifica diariamente os eventos de calendário do dia seguinte que estão
 * ligados a uma lead, e dispara a automação "visit_scheduled" (Definições >
 * Automação) configurada para cada consultor — com a data, hora e local
 * REAIS da visita (variáveis {data_visita}, {hora_visita}, {local_visita},
 * {titulo_visita}), não um texto genérico.
 *
 * Antes desta automação, o gatilho "visit_scheduled" existia no seletor mas
 * nunca era verificado por nenhum cron — nunca disparava.
 *
 * Cada evento só dispara uma vez (rastreado por evento, não só por lead —
 * uma lead pode ter várias visitas ao longo do tempo, cada uma com o seu
 * próprio aviso).
 *
 * Configurado no vercel.json para executar diariamente.
 */

interface EventRow {
  id: string;
  user_id: string;
  lead_id: string;
  title: string;
  start_time: string;
  location: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Visit Reminders] Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Visit Reminders] Starting at", new Date().toISOString());

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = { checked: 0, fired: 0, skippedAlreadyFired: 0, errors: 0 };

  try {
    const { data: activeRules } = await supabaseAdmin
      .from("lead_workflow_rules")
      .select("user_id")
      .eq("trigger_status", "visit_scheduled")
      .eq("enabled", true);

    const eligibleUserIds = Array.from(new Set((activeRules || []).map((r: { user_id: string }) => r.user_id)));

    if (eligibleUserIds.length === 0) {
      console.log("[Visit Reminders] Nenhuma automação ativa. A terminar.");
      return res.status(200).json({ success: true, message: "Sem automações ativas", result });
    }

    // "Amanhã", relativo ao momento em que o cron corre.
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("calendar_events")
      .select("id, user_id, lead_id, title, start_time, location")
      .in("user_id", eligibleUserIds)
      .not("lead_id", "is", null)
      .gte("start_time", tomorrowStart.toISOString())
      .lt("start_time", tomorrowEnd.toISOString());

    if (eventsError) {
      console.error("[Visit Reminders] Erro ao procurar eventos:", eventsError);
      return res.status(500).json({ error: eventsError.message });
    }

    result.checked = (events || []).length;

    for (const event of (events || []) as EventRow[]) {
      try {
        // Rastreado por evento (não só por lead) — a mesma lead pode ter
        // várias visitas ao longo do tempo, cada uma com o seu próprio aviso.
        const { data: existingLog } = await supabaseAdmin
          .from("workflow_trigger_log")
          .select("tracked_value")
          .eq("lead_id", event.lead_id)
          .eq("trigger_type", "visit_scheduled")
          .maybeSingle();

        if (existingLog && existingLog.tracked_value === event.id) {
          result.skippedAlreadyFired++;
          continue;
        }

        const workflowResult = await runLeadWorkflows({
          // NOTA: cast necessário por um conflito de tipos genéricos entre
          // instâncias de SupabaseClient — mesmo problema já resolvido da
          // mesma forma em stale-lead-checks.ts e workflowEngine.ts.
          supabase: supabaseAdmin as any,
          userId: event.user_id,
          leadId: event.lead_id,
          triggerType: "visit_scheduled",
          eventContext: {
            title: event.title,
            startTime: event.start_time,
            location: event.location,
          },
        });

        if (!workflowResult.success) {
          result.errors++;
        }

        await supabaseAdmin.from("workflow_trigger_log").upsert(
          { lead_id: event.lead_id, trigger_type: "visit_scheduled", tracked_value: event.id, alert_count: 1, fired_at: now.toISOString() },
          { onConflict: "lead_id,trigger_type" }
        );

        result.fired++;
      } catch (eventError) {
        console.error(`[Visit Reminders] Erro ao processar evento ${event.id}:`, eventError);
        result.errors++;
      }
    }

    console.log("[Visit Reminders] Concluído:", JSON.stringify(result));
    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    console.error("[Visit Reminders] Erro:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
