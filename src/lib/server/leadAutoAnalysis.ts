import { runAI } from "@/lib/ai/provider";
import { getLeadAutoAnalysisPrompt } from "@/lib/ai/prompts/leadAutoAnalysis";
import { getLeadQualification, formatCurrentQualificationValue, mapExtractedDataToLeadUpdate } from "@/lib/leadQualification";
import { storeMemory } from "@/lib/ai/embeddings";
import { buildLeadEventTitle } from "@/lib/leadEventTitle";
import { getCapabilityLevel, recordAiAction } from "@/lib/server/aiActions";
import { getPipelineStagesForLead } from "@/lib/server/pipelineStages";

/**
 * Análise automática de uma lead após um novo registo (nota, interação ou
 * nota de voz).
 *
 * Modelo "híbrido" acordado com o utilizador:
 * - Aplicados automaticamente: temperatura, status, dados de qualificação
 *   (apenas campos vazios) e tarefas.
 * - Blocos de agenda: criados como "por confirmar" (calendar_events.ai_pending
 *   = true) — o consultor confirma ou rejeita no calendário. Não são
 *   sincronizados com o Google Calendar até serem confirmados.
 * - O consultor é SEMPRE informado do que a IA fez, via notificação
 *   persistente (campainha) com o resumo e as próximas ações sugeridas.
 *
 * Guardas (sem custo de IA): toggle do consultor desligado, automações em
 * pausa, ou análise há menos de 5 minutos (debounce — o consultor costuma
 * adicionar nota + interação seguidas).
 *
 * Nunca lança exceções para o chamador: uma falha de IA (sem chave, quota,
 * JSON inválido) não pode impedir a criação da nota/interação que a
 * despoletou.
 */

const DEBOUNCE_MINUTES = 5;

export type LeadAutoAnalysisTrigger = "note" | "interaction" | "voice_note";

interface AutoAnalysisTask {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
}

interface AutoAnalysisAgendaBlock {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  event_type?: string;
}

interface AutoAnalysisResult {
  summary: string;
  suggested_status?: string;
  suggested_temperature?: string;
  extracted_data?: Record<string, unknown>;
  tasks?: AutoAnalysisTask[];
  agenda_blocks?: AutoAnalysisAgendaBlock[];
  next_actions?: string[];
}

export interface AppliedAutoAnalysis {
  summary: string;
  temperature?: { from: string; to: string };
  status?: { from: string; to: string };
  qualification_fields: string[];
  tasks_created: string[];
  agenda_blocks_pending: string[];
  next_actions: string[];
  /** Ações que ficaram à espera de aprovação na caixa de entrada. */
  proposed: string[];
}

export interface RunLeadAutoAnalysisParams {
  supabaseAdmin: any;
  userId: string;
  leadId: string;
  trigger: LeadAutoAnalysisTrigger;
  /** O conteúdo do registo que acabou de ser adicionado. */
  newContent: string;
  /** Ignora o debounce (usado pela nota de voz, que é sempre conteúdo novo relevante). */
  skipDebounce?: boolean;
}

export async function runLeadAutoAnalysis(
  params: RunLeadAutoAnalysisParams
): Promise<{ ran: boolean; applied?: AppliedAutoAnalysis; skippedReason?: string }> {
  const { supabaseAdmin, userId, leadId, trigger, newContent, skipDebounce } = params;

  try {
    if (!newContent || !newContent.trim()) {
      return { ran: false, skippedReason: "sem_conteudo" };
    }

    // Guardas — por ordem, sem custo de IA.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("lead_auto_analysis_enabled, automation_paused, ai_capability_levels")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.lead_auto_analysis_enabled === false) {
      return { ran: false, skippedReason: "toggle_desligado" };
    }
    if (profile?.automation_paused === true) {
      return { ran: false, skippedReason: "automacao_em_pausa" };
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (!lead) {
      return { ran: false, skippedReason: "lead_nao_encontrada" };
    }

    if (!skipDebounce && lead.last_ai_analysis_at) {
      const minutesSince = (Date.now() - new Date(lead.last_ai_analysis_at).getTime()) / 60000;
      if (minutesSince < DEBOUNCE_MINUTES) {
        return { ran: false, skippedReason: "debounce" };
      }
    }

    // Contexto: histórico recente + campos de qualificação relevantes.
    const [{ data: interactions }, { data: notes }] = await Promise.all([
      supabaseAdmin
        .from("interactions")
        .select("interaction_date, interaction_type, content, outcome")
        .eq("lead_id", leadId)
        .order("interaction_date", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("lead_notes")
        .select("note, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const { relevantFields } = getLeadQualification(lead);
    const qualificationFields = relevantFields.map((field) => ({
      key: field.key,
      label: field.label,
      currentValue: formatCurrentQualificationValue(lead, field.key),
    }));

    // Fases reais desta instalação (personalizáveis) — sem isto a IA sugeria
    // fases em inglês que nunca correspondiam e eram sempre descartadas.
    const pipelineStages = await getPipelineStagesForLead(supabaseAdmin, lead.lead_type);

    const prompt = getLeadAutoAnalysisPrompt({
      newContent,
      trigger,
      leadData: {
        name: lead.name,
        status: lead.status,
        temperature: lead.temperature || "cold",
        lead_type: lead.lead_type,
        property_type: lead.property_type,
        location_preference: lead.location_preference,
        budget: lead.budget,
      },
      recentInteractions: interactions || [],
      recentNotes: notes || [],
      qualificationFields,
      pipelineStages,
    });

    const aiResponse = await runAI({
      userId,
      task: "lead_auto_analysis",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.3,
    });

    let analysis: AutoAnalysisResult;
    try {
      analysis = JSON.parse(aiResponse.text);
    } catch (parseError) {
      console.error(`[Lead Auto Analysis] Resposta da IA não é JSON válido (lead ${leadId}):`, parseError);
      return { ran: false, skippedReason: "json_invalido" };
    }

    if (!analysis || typeof analysis.summary !== "string") {
      return { ran: false, skippedReason: "resposta_incompleta" };
    }

    const now = new Date().toISOString();
    const applied: AppliedAutoAnalysis = {
      summary: analysis.summary,
      qualification_fields: [],
      tasks_created: [],
      agenda_blocks_pending: [],
      proposed: [],
      next_actions: Array.isArray(analysis.next_actions)
        ? analysis.next_actions.filter((a) => typeof a === "string" && a.trim()).slice(0, 3)
        : [],
    };

    // Níveis configurados pelo consultor para cada capacidade.
    const levels = profile?.ai_capability_levels;
    const qualificationLevel = getCapabilityLevel(levels, "lead_qualification");
    const temperatureLevel = getCapabilityLevel(levels, "lead_temperature");
    const statusLevel = getCapabilityLevel(levels, "lead_status");
    const taskLevel = getCapabilityLevel(levels, "task_create");
    const calendarLevel = getCapabilityLevel(levels, "calendar_block");

    // Carimbo da análise — não é uma "alteração" ao trabalho do consultor,
    // por isso é sempre gravado diretamente (serve o debounce).
    await supabaseAdmin
      .from("leads")
      .update({ last_ai_analysis_at: now, updated_at: now })
      .eq("id", leadId);

    // 1a. Qualificação — só campos VAZIOS. Nunca sobrescreve o que o
    // consultor já preencheu, por isso é a única que corre em automático.
    const proposedQualification = mapExtractedDataToLeadUpdate(analysis.extracted_data || {});
    const qualificationUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(proposedQualification)) {
      const currentValue = (lead as Record<string, unknown>)[key];
      if (currentValue === undefined || currentValue === null || currentValue === "") {
        qualificationUpdates[key] = value;
      }
    }
    if (Object.keys(qualificationUpdates).length > 0) {
      const fieldNames = Object.keys(qualificationUpdates);
      const { applied: wasApplied } = await recordAiAction({
        supabaseAdmin,
        userId,
        capability: "lead_qualification",
        level: qualificationLevel,
        entityType: "lead",
        entityId: leadId,
        leadId,
        title: `Preencher qualificação de ${lead.name}: ${fieldNames.join(", ")}`,
        reason: analysis.summary,
        source: trigger,
        payload: { updates: qualificationUpdates },
        previousState: Object.fromEntries(fieldNames.map((f) => [f, null])),
      });
      if (wasApplied) {
        applied.qualification_fields.push(...fieldNames);
      } else if (qualificationLevel === "propose") {
        applied.proposed.push(`Qualificação: ${fieldNames.join(", ")}`);
      }
    }

    // 1b. Temperatura — altera algo que o consultor pode ter definido.
    const validTemperatures = ["hot", "warm", "cold"];
    if (
      analysis.suggested_temperature &&
      validTemperatures.includes(analysis.suggested_temperature) &&
      analysis.suggested_temperature !== lead.temperature
    ) {
      const from = lead.temperature || "cold";
      const to = analysis.suggested_temperature;
      const { applied: wasApplied } = await recordAiAction({
        supabaseAdmin,
        userId,
        capability: "lead_temperature",
        level: temperatureLevel,
        entityType: "lead",
        entityId: leadId,
        leadId,
        title: `Temperatura de ${lead.name}: ${from} → ${to}`,
        reason: analysis.summary,
        source: trigger,
        payload: { updates: { temperature: to } },
        previousState: { temperature: from },
      });
      if (wasApplied) {
        applied.temperature = { from, to };
      } else if (temperatureLevel === "propose") {
        applied.proposed.push(`Temperatura: ${from} → ${to}`);
      }
    }

    // 1c. Fase do pipeline — validada contra as fases REAIS desta agência.
    if (
      analysis.suggested_status &&
      pipelineStages.includes(analysis.suggested_status) &&
      analysis.suggested_status !== lead.status
    ) {
      const from = lead.status;
      const to = analysis.suggested_status;
      const { applied: wasApplied } = await recordAiAction({
        supabaseAdmin,
        userId,
        capability: "lead_status",
        level: statusLevel,
        entityType: "lead",
        entityId: leadId,
        leadId,
        title: `Fase de ${lead.name}: ${from} → ${to}`,
        reason: analysis.summary,
        source: trigger,
        payload: { updates: { status: to } },
        previousState: { status: from },
      });
      if (wasApplied) {
        applied.status = { from, to };
      } else if (statusLevel === "propose") {
        applied.proposed.push(`Fase: ${from} → ${to}`);
      }
    }

    // 2. Tarefas (máx. 2, garantido também aqui e não só no prompt).
    const tasks = (Array.isArray(analysis.tasks) ? analysis.tasks : [])
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .slice(0, 2);
    for (const task of tasks) {
      const priority = ["urgent", "high", "medium", "low"].includes(task.priority || "")
        ? task.priority
        : "medium";
      const { applied: wasApplied } = await recordAiAction({
        supabaseAdmin,
        userId,
        capability: "task_create",
        level: taskLevel,
        entityType: "task",
        leadId,
        title: `Tarefa para ${lead.name}: ${task.title}`,
        reason: task.description || analysis.summary,
        source: trigger,
        payload: {
          task: {
            title: task.title,
            description: task.description || null,
            due_date: task.due_date || null,
            priority,
          },
        },
      });
      if (wasApplied) {
        applied.tasks_created.push(task.title);
      } else if (taskLevel === "propose") {
        applied.proposed.push(`Tarefa: ${task.title}`);
      }
    }

    // 3. Blocos de agenda "por confirmar" (ai_pending) — sem sync Google até
    // o consultor confirmar no calendário.
    const agendaBlocks = calendarLevel === "off"
      ? []
      : (Array.isArray(analysis.agenda_blocks) ? analysis.agenda_blocks : [])
          .filter((b) => b && typeof b.title === "string" && b.title.trim() && b.start_time)
          .slice(0, 2);
    for (const block of agendaBlocks) {
      const start = new Date(block.start_time);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
        // Sem data válida ou no passado — a IA baralhou-se; ignorar.
        continue;
      }
      const end = block.end_time ? new Date(block.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
      const eventType = ["viewing", "meeting", "call", "followup"].includes(block.event_type || "")
        ? (block.event_type as string)
        : "meeting";

      // Título normalizado "Tema - Nome da lead" (ex.: "Chamada - David
      // Santos"), para os eventos criados a partir da lead ficarem uniformes
      // e identificáveis na agenda. O título descritivo da IA vai para a
      // descrição, junto com o excerto que originou o bloco.
      const eventTitle = buildLeadEventTitle(eventType, lead.name);
      const descriptionParts = [
        block.title,
        block.description || "",
        `Criado automaticamente pela IA a partir de: "${newContent.substring(0, 200)}"`,
      ].filter((part) => part && part.trim());

      const { error: eventError } = await supabaseAdmin.from("calendar_events").insert({
        user_id: userId,
        lead_id: leadId,
        title: eventTitle,
        description: descriptionParts.join("\n\n"),
        start_time: start.toISOString(),
        end_time: (Number.isNaN(end.getTime()) ? new Date(start.getTime() + 60 * 60 * 1000) : end).toISOString(),
        event_type: eventType,
        ai_pending: true,
      });
      if (eventError) {
        console.error(`[Lead Auto Analysis] Erro ao criar bloco de agenda (lead ${leadId}):`, eventError);
      } else {
        applied.agenda_blocks_pending.push(eventTitle);
      }
    }

    // 4. Memória de longo prazo da lead (best-effort).
    try {
      await storeMemory({
        leadId,
        userId,
        source: `auto_analysis_${trigger}`,
        content: analysis.summary,
        supabaseClient: supabaseAdmin,
      });
    } catch (memoryError) {
      console.error(`[Lead Auto Analysis] Erro ao guardar memória (lead ${leadId}):`, memoryError);
    }

    // 5. Informar o consultor — notificação persistente na campainha.
    const notificationLines: string[] = [analysis.summary];
    if (applied.temperature) {
      notificationLines.push(`🌡️ Temperatura: ${applied.temperature.from} → ${applied.temperature.to}`);
    }
    if (applied.status) {
      notificationLines.push(`🎯 Status: ${applied.status.from} → ${applied.status.to}`);
    }
    if (applied.qualification_fields.length > 0) {
      notificationLines.push(`📋 Qualificação preenchida: ${applied.qualification_fields.join(", ")}`);
    }
    for (const title of applied.tasks_created) {
      notificationLines.push(`✅ Tarefa criada: ${title}`);
    }
    for (const title of applied.agenda_blocks_pending) {
      notificationLines.push(`📅 Bloco na agenda POR CONFIRMAR: ${title}`);
    }
    if (applied.proposed.length > 0) {
      notificationLines.push(
        `⏳ À espera da tua aprovação (${applied.proposed.length}): ${applied.proposed.join(" · ")}`
      );
    }
    if (applied.next_actions.length > 0) {
      notificationLines.push(`💡 Sugestões: ${applied.next_actions.join(" · ")}`);
    }

    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: `🤖 IA analisou ${lead.name}`,
      message: notificationLines.join("\n"),
      notification_type: "info",
      is_read: false,
      related_entity_id: leadId,
      related_entity_type: "lead",
    });
    if (notificationError) {
      console.error(`[Lead Auto Analysis] Erro ao criar notificação (lead ${leadId}):`, notificationError);
    }

    console.log(`[Lead Auto Analysis] Lead ${leadId} analisada (trigger: ${trigger}):`, {
      temperature: applied.temperature,
      status: applied.status,
      tasks: applied.tasks_created.length,
      agenda: applied.agenda_blocks_pending.length,
    });

    return { ran: true, applied };
  } catch (error: any) {
    // Nunca propagar: a análise é acessória à ação do consultor.
    console.error(`[Lead Auto Analysis] Erro inesperado (lead ${leadId}):`, error?.message || error);
    return { ran: false, skippedReason: "erro_interno" };
  }
}
