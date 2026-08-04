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

    const [tasksResult, eventsResult, followUpResult, hotLeadsResult, recentLeadsResult, profileResult, inboxResult] = await Promise.all([
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
      (supabaseAdmin as any)
        .from("leads")
        .select("id, name, next_follow_up, temperature, phone, email, conversion_probability")
        .eq("user_id", user.id)
        .not("follow_up_state", "in", '("archived","opt_out")')
        .not("next_follow_up", "is", null)
        .lte("next_follow_up", todayEndISO)
        .order("next_follow_up", { ascending: true })
        .limit(15),
      (supabaseAdmin as any)
        .from("leads")
        .select("id, name, last_contact_date, phone, email, conversion_probability")
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
      (supabaseAdmin as any)
        .from("inbox_triage")
        .select("id, reminder, lead_id, urgency, from_name")
        .eq("user_id", user.id)
        .eq("status", "new")
        .eq("importance", "high")
        .order("created_at", { ascending: false })
        .limit(5),
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

    // ------------------------------------------------------------------
    // "As 3 de hoje": em vez de N listas com o mesmo peso, escolhe-se — com
    // pontuação determinística e explicável — as três ações que mais valem o
    // tempo do consultor AGORA. Cruzam-se urgência (atraso), valor da lead
    // (probabilidade de conversão do scoring preditivo + temperatura) e os
    // sinais do Assistente de Emails. Uma ação por lead, para as três não
    // serem a mesma pessoa.
    // ------------------------------------------------------------------
    interface TopAction {
      kind: "task_overdue" | "task_today" | "follow_up" | "hot_stale" | "inbox";
      title: string;
      reason: string;
      leadId?: string | null;
      taskId?: string | null;
      score: number;
    }
    const candidates: TopAction[] = [];
    const priorityBonus = (p: string | null) =>
      p === "urgent" ? 25 : p === "high" ? 18 : p === "medium" ? 8 : 0;
    const probBonus = (p: unknown) => {
      const n = Number(p);
      return Number.isFinite(n) ? Math.min(20, Math.round(n / 5)) : 0;
    };

    for (const t of overdueTasks) {
      const daysLate = Math.max(1, Math.floor((now.getTime() - new Date(t.due_date!).getTime()) / 86400000));
      candidates.push({
        kind: "task_overdue",
        title: t.title,
        reason: `Tarefa atrasada há ${daysLate} dia${daysLate === 1 ? "" : "s"}${t.priority === "high" || t.priority === "urgent" ? ", prioridade alta" : ""}`,
        leadId: t.related_lead_id,
        taskId: t.id,
        score: 50 + priorityBonus(t.priority) + Math.min(18, daysLate * 3),
      });
    }
    for (const t of todayTasks) {
      candidates.push({
        kind: "task_today",
        title: t.title,
        reason: `Vence hoje${t.priority === "high" || t.priority === "urgent" ? ", prioridade alta" : ""}`,
        leadId: t.related_lead_id,
        taskId: t.id,
        score: 40 + priorityBonus(t.priority),
      });
    }
    for (const l of followUpDueLeads as any[]) {
      const prob = Number(l.conversion_probability);
      candidates.push({
        kind: "follow_up",
        title: `Retomar contacto com ${l.name}`,
        reason: [
          "Follow-up vencido",
          l.temperature === "hot" ? "lead quente" : l.temperature === "warm" ? "lead morna" : null,
          Number.isFinite(prob) ? `${Math.round(prob)}% prob. de conversão` : null,
        ].filter(Boolean).join(" · "),
        leadId: l.id,
        score: 55 + (l.temperature === "hot" ? 20 : l.temperature === "warm" ? 8 : 0) + probBonus(l.conversion_probability),
      });
    }
    for (const l of hotLeadsStale as any[]) {
      const days = l.last_contact_date
        ? Math.floor((now.getTime() - new Date(l.last_contact_date).getTime()) / 86400000)
        : null;
      const prob = Number(l.conversion_probability);
      candidates.push({
        kind: "hot_stale",
        title: `Ligar a ${l.name} antes que arrefeça`,
        reason: [
          days !== null ? `Lead quente sem contacto há ${days} dias` : "Lead quente sem contacto registado",
          Number.isFinite(prob) ? `${Math.round(prob)}% prob. de conversão` : null,
        ].filter(Boolean).join(" · "),
        leadId: l.id,
        score: 58 + Math.min(16, (days ?? 8) * 2) + probBonus(l.conversion_probability),
      });
    }
    for (const r of ((inboxResult as any)?.data || []) as any[]) {
      if (!r.reminder) continue;
      candidates.push({
        kind: "inbox",
        title: r.reminder,
        reason: `Email prioritário${r.from_name ? ` de ${r.from_name}` : ""} no Assistente de Emails`,
        leadId: r.lead_id,
        score: 62 + (Number(r.urgency) >= 5 ? 12 : 6),
      });
    }

    // Uma ação por lead (a melhor); ações sem lead concorrem individualmente.
    const bestByKey = new Map<string, TopAction>();
    for (const c of candidates) {
      const key = c.leadId || `solo-${c.kind}-${c.taskId || c.title}`;
      const existing = bestByKey.get(key);
      if (!existing || c.score > existing.score) bestByKey.set(key, c);
    }
    const topThree = Array.from(bestByKey.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

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
      topThree,
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
