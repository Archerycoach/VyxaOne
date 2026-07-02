import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getDailySummaryPrompt } from "@/lib/ai/prompts/dailyOrganizer";
import { getLeadQualification } from "@/lib/leadQualification";

/**
 * Hub "Hoje" — plano de ação diário do consultor.
 *
 * Ao contrário da versão anterior (que devolvia um bloco de texto livre
 * gerado pela IA), este endpoint calcula as listas de ação de forma
 * determinística (tarefas atrasadas, eventos de hoje, leads para retomar
 * contacto, leads quentes a arrefecer, leads quase qualificadas) — rápido,
 * sempre correto e sem custo de IA. A IA só é usada para um resumo curto e
 * priorizado no topo, com base nas contagens já calculadas.
 */

interface TaskRecord {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  related_lead_id: string | null;
}

interface EventRecord {
  id: string;
  title: string;
  start_time: string;
  event_type: string | null;
  lead_id: string | null;
}

interface FollowUpLeadRecord {
  id: string;
  name: string;
  next_follow_up: string | null;
  temperature: string | null;
  phone: string | null;
  email: string | null;
}

interface HotLeadRecord {
  id: string;
  name: string;
  last_contact_date: string | null;
  phone: string | null;
  email: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const [tasksResult, eventsResult, followUpResult, hotLeadsResult, recentLeadsResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("tasks")
        .select("id, title, due_date, priority, related_lead_id")
        .eq("user_id", user.id)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(50),
      supabaseAdmin
        .from("calendar_events")
        .select("id, title, start_time, event_type, lead_id")
        .eq("user_id", user.id)
        .gte("start_time", todayStartISO)
        .lt("start_time", todayEndISO)
        .order("start_time", { ascending: true }),
      supabaseAdmin
        .from("leads")
        .select("id, name, next_follow_up, temperature, phone, email")
        .eq("user_id", user.id)
        .not("follow_up_state", "in", '("archived","opt_out")')
        .not("next_follow_up", "is", null)
        .lte("next_follow_up", todayEndISO)
        .order("next_follow_up", { ascending: true })
        .limit(15),
      supabaseAdmin
        .from("leads")
        .select("id, name, last_contact_date, phone, email")
        .eq("user_id", user.id)
        .eq("temperature", "hot")
        .not("follow_up_state", "in", '("archived","opt_out")')
        .limit(30),
      supabaseAdmin
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .not("follow_up_state", "in", '("archived","opt_out")')
        .order("updated_at", { ascending: false })
        .limit(40),
      supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

    const allTasks = (tasksResult.data || []) as TaskRecord[];
    const overdueTasks = allTasks.filter((t) => t.due_date && t.due_date < todayStartISO);
    const todayTasks = allTasks.filter((t) => t.due_date && t.due_date >= todayStartISO && t.due_date < todayEndISO);

    const todayEvents = (eventsResult.data || []) as EventRecord[];
    const followUpDueLeads = (followUpResult.data || []) as FollowUpLeadRecord[];

    const hotLeadsStale = ((hotLeadsResult.data || []) as HotLeadRecord[]).filter(
      (lead) => !lead.last_contact_date || new Date(lead.last_contact_date) < threeDaysAgo
    );

    const qualificationGaps = (recentLeadsResult.data || [])
      .map((lead: any) => {
        const qualification = getLeadQualification(lead);
        return {
          id: lead.id as string,
          name: lead.name as string,
          missing: qualification.missing,
          total: qualification.total,
          filled: qualification.filled,
        };
      })
      .filter((entry) => entry.total > 0 && entry.missing.length > 0)
      .sort((a, b) => a.missing.length - b.missing.length)
      .slice(0, 8);

    const highlights: string[] = [];
    if (todayEvents.length > 0) {
      highlights.push(
        `Primeiro compromisso: ${todayEvents[0].title} às ${new Date(todayEvents[0].start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
      );
    }
    if (overdueTasks.length > 0) {
      highlights.push(`Tarefa mais atrasada: ${overdueTasks[0].title}`);
    }
    if (hotLeadsStale.length > 0) {
      highlights.push(`Lead quente a arrefecer: ${hotLeadsStale[0].name}`);
    }

    const consultantName = (profileResult.data as { full_name?: string } | null)?.full_name?.split(" ")[0] || "Consultor";

    let summary = "";
    try {
      const prompt = getDailySummaryPrompt({
        consultantName,
        overdueTasksCount: overdueTasks.length,
        todayTasksCount: todayTasks.length,
        todayEventsCount: todayEvents.length,
        followUpDueCount: followUpDueLeads.length,
        hotLeadsStaleCount: hotLeadsStale.length,
        qualificationGapsCount: qualificationGaps.length,
        highlights,
      });

      const aiResponse = await runAI({
        userId: user.id,
        task: "daily_summary",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        maxTokens: 200,
      });

      summary = aiResponse.text.trim();
    } catch (aiError) {
      console.error("[Organizer] Falha ao gerar resumo IA (não bloqueante):", aiError);
    }

    return res.status(200).json({
      summary,
      overdueTasks,
      todayTasks,
      todayEvents,
      followUpDueLeads,
      hotLeadsStale,
      qualificationGaps,
    });
  } catch (error: any) {
    console.error("Organizer Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
