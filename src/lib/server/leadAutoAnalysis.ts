import { runAI } from "@/lib/ai/provider";
import { sendPushToUser } from "@/lib/server/webPush";
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

// Palavras sem peso na comparação de tarefas — artigos, preposições e verbos
// genéricos que aparecem em quase todos os títulos.
const TASK_STOPWORDS = new Set([
  "o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "e", "ou",
  "em", "no", "na", "nos", "nas", "para", "por", "com", "ao", "aos", "sobre", "que",
]);

function taskTitleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1 && !TASK_STOPWORDS.has(word))
  );
}

/**
 * Duas tarefas contam como a mesma quando as palavras significativas de uma
 * cobrem ≥70% das da mais curta ("Enviar informação dos T3 do Oliveira e
 * Telles" ≈ "Enviar informação dos T3 do Oliveira e do Telles").
 */
function isSimilarToExistingTask(title: string, existingTitles: string[]): boolean {
  const candidate = taskTitleTokens(title);
  if (candidate.size === 0) return false;

  for (const existing of existingTitles) {
    const other = taskTitleTokens(existing);
    if (other.size === 0) continue;
    let shared = 0;
    for (const token of candidate) {
      if (other.has(token)) shared += 1;
    }
    if (shared / Math.min(candidate.size, other.size) >= 0.7) {
      return true;
    }
  }
  return false;
}

export type LeadAutoAnalysisTrigger = "note" | "interaction" | "voice_note";

interface AutoAnalysisTask {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
}

/**
 * Horas candidatas por período do dia (hora LOCAL de Lisboa). Usadas quando o
 * cliente indica o dia mas não a hora ("ligar domingo da parte da tarde") — o
 * evento é criado no primeiro horário LIVRE do período.
 */
const PERIOD_HOURS: Record<string, number[]> = {
  manha: [9, 10, 11],
  tarde: [14, 15, 16, 17, 18],
  noite: [19, 20],
};

/** Constrói um Date para as HH:00 locais de Lisboa numa dada data. */
function lisbonHourToDate(dateStr: string, hour: number): Date {
  // Offset de Lisboa nessa data (0 no inverno, 1 no verão), medido com uma sonda.
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const lisbonH = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hour12: false }).format(probe),
    10,
  );
  const offsetH = lisbonH - 12;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - offsetH, 0, 0));
}

/**
 * Primeiro horário LIVRE (blocos de 1h) no período pedido desse dia. Se tudo
 * estiver ocupado, devolve a primeira hora do período — o aviso de conflito a
 * jusante encarrega-se de alertar o consultor.
 */
async function findFreeSlotStart(
  supabaseAdmin: any,
  userId: string,
  dateStr: string,
  period: string | undefined,
): Promise<Date> {
  const hours = PERIOD_HOURS[period || ""] || PERIOD_HOURS.tarde;

  const dayStart = lisbonHourToDate(dateStr, 0);
  const dayEnd = lisbonHourToDate(dateStr, 23);
  const { data: dayEvents } = await supabaseAdmin
    .from("calendar_events")
    .select("start_time, end_time")
    .eq("user_id", userId)
    .neq("is_bookable", true)
    .lt("start_time", dayEnd.toISOString())
    .gt("end_time", dayStart.toISOString());

  const busy = ((dayEvents || []) as Array<{ start_time: string; end_time: string }>).map((e) => ({
    start: new Date(e.start_time).getTime(),
    end: new Date(e.end_time).getTime(),
  }));

  for (const hour of hours) {
    const start = lisbonHourToDate(dateStr, hour);
    const end = start.getTime() + 60 * 60 * 1000;
    const overlaps = busy.some((b) => b.start < end && b.end > start.getTime());
    if (!overlaps) return start;
  }
  return lisbonHourToDate(dateStr, hours[0]);
}

interface AutoAnalysisAgendaBlock {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  /** Dia sem hora ("ligar domingo à tarde"): a IA devolve date+period e o
   *  sistema escolhe um horário livre no período. */
  date?: string;
  period?: string;
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
  /** Blocos criados que se sobrepõem a compromissos já existentes. */
  agenda_conflicts: string[];
  /**
   * Blocos que a IA propôs mas não foram criados, com o motivo.
   * Nunca descartamos em silêncio: se a IA percebeu um compromisso e ele não
   * chegou à agenda, o consultor tem de ficar a saber.
   */
  agenda_skipped: string[];
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
    // As tarefas abertas entram no contexto E no dedupe: sem elas, uma segunda
    // análise (nova nota/mensagem passado o debounce) propunha a mesma tarefa
    // com outras palavras e a lead acumulava duplicados.
    const [{ data: interactions }, { data: notes }, { data: openTasks }] = await Promise.all([
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
      supabaseAdmin
        .from("tasks")
        .select("title, description, due_date")
        .eq("related_lead_id", leadId)
        .eq("user_id", userId)
        .neq("status", "completed")
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
      openTasks: openTasks || [],
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
      agenda_conflicts: [],
      agenda_skipped: [],
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
    // Rede de segurança contra duplicados: o prompt já mostra as tarefas
    // abertas, mas a IA por vezes reformula a mesma ação com outras palavras
    // ("…do Oliveira e Telles" vs "…do Oliveira e do Telles") — compara-se por
    // sobreposição de palavras significativas, não por igualdade exata.
    const existingTaskTitles = ((openTasks || []) as Array<{ title: string | null }>)
      .map((t) => t.title || "")
      .filter(Boolean);
    const tasks = (Array.isArray(analysis.tasks) ? analysis.tasks : [])
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .slice(0, 2);
    for (const task of tasks) {
      if (isSimilarToExistingTask(task.title, existingTaskTitles)) {
        continue;
      }
      existingTaskTitles.push(task.title);
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
          .filter(
            (b) =>
              b && typeof b.title === "string" && b.title.trim() &&
              (b.start_time || (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date))),
          )
          .slice(0, 2);
    for (const block of agendaBlocks) {
      // Dia SEM hora ("ligar domingo da parte da tarde"): escolhe um horário
      // LIVRE no período indicado (por defeito, a tarde) desse dia.
      if (!block.start_time && block.date) {
        const slot = await findFreeSlotStart(supabaseAdmin, userId, block.date, block.period);
        block.start_time = slot.toISOString();
        block.end_time = new Date(slot.getTime() + 60 * 60 * 1000).toISOString();
        console.log(
          `[Lead Auto Analysis] Bloco "${block.title}" sem hora — slot livre escolhido: ${block.start_time} (período ${block.period || "tarde"}).`
        );
      }
      const rawStart = new Date(block.start_time);

      if (Number.isNaN(rawStart.getTime())) {
        applied.agenda_skipped.push(`${block.title} (data inválida)`);
        continue;
      }

      // Data no passado: quase sempre é a IA a resolver um dia da semana para
      // a ocorrência que já passou ("quarta" quando hoje é sexta). Nesse caso
      // avançamos uma semana, que é o que o cliente quis dizer. Só dentro de
      // 7 dias — mais do que isso já não é referência a dia da semana e não
      // devemos adivinhar.
      let shiftMs = 0;
      if (rawStart.getTime() < Date.now()) {
        const daysInPast = (Date.now() - rawStart.getTime()) / (1000 * 60 * 60 * 24);
        if (daysInPast > 7) {
          applied.agenda_skipped.push(
            `${block.title} (data no passado: ${rawStart.toLocaleDateString("pt-PT")})`
          );
          continue;
        }
        shiftMs = 7 * 24 * 60 * 60 * 1000;
        console.log(
          `[Lead Auto Analysis] Bloco "${block.title}" vinha no passado (${rawStart.toISOString()}); avançado uma semana.`
        );
      }

      // O mesmo deslocamento aplica-se ao fim, senão a duração ficava errada.
      const start = new Date(rawStart.getTime() + shiftMs);
      const rawEnd = block.end_time ? new Date(block.end_time) : null;
      const end = rawEnd && !Number.isNaN(rawEnd.getTime())
        ? new Date(rawEnd.getTime() + shiftMs)
        : new Date(start.getTime() + 60 * 60 * 1000);
      const eventType = ["viewing", "meeting", "call", "followup"].includes(block.event_type || "")
        ? (block.event_type as string)
        : "meeting";

      // Título normalizado "Tema - Nome da lead" (ex.: "Chamada - David
      // Santos"), para os eventos criados a partir da lead ficarem uniformes
      // e identificáveis na agenda. O título descritivo da IA vai para a
      // descrição, junto com o excerto que originou o bloco.
      const eventTitle = buildLeadEventTitle(eventType, lead.name);

      // Já existe um evento desta lead à mesma hora e do mesmo tipo?
      // Acontece quando a análise corre duas vezes sobre a mesma nota (dois
      // gatilhos, um reenvio) — e criava a MESMA chamada em duplicado, que o
      // consultor depois tinha de limpar à mão.
      const { data: duplicates } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .eq("lead_id", leadId)
        .eq("event_type", eventType)
        .gte("start_time", new Date(start.getTime() - 30 * 60 * 1000).toISOString())
        .lte("start_time", new Date(start.getTime() + 30 * 60 * 1000).toISOString())
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        applied.agenda_skipped.push(`${block.title} (já existe um evento igual nessa hora)`);
        continue;
      }

      // O horário já está ocupado? O bloco é criado na mesma — o consultor
      // pode ter boas razões para sobrepor — mas fica avisado para resolver.
      // Blocos de disponibilidade (is_bookable) não contam como ocupação.
      const { data: overlapping } = await supabaseAdmin
        .from("calendar_events")
        .select("title, start_time, end_time")
        .eq("user_id", userId)
        .neq("is_bookable", true)
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .limit(3);

      const conflicts = (overlapping || []) as Array<{ title: string; start_time: string }>;

      const descriptionParts = [
        block.title,
        block.description || "",
        conflicts.length > 0
          ? `⚠️ CONFLITO: sobrepõe-se a ${conflicts.map((c) => c.title).join(", ")}. Confirma se queres manter os dois ou mudar a hora.`
          : "",
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
        applied.agenda_skipped.push(`${block.title} (erro ao gravar)`);
      } else {
        const when = start.toLocaleString("pt-PT", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        applied.agenda_blocks_pending.push(`${eventTitle} — ${when}`);
        if (conflicts.length > 0) {
          applied.agenda_conflicts.push(
            `${eventTitle} (${when}) sobrepõe-se a: ${conflicts.map((c) => c.title).join(", ")}`
          );
        }
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
    if (applied.agenda_conflicts.length > 0) {
      notificationLines.push(
        `⚠️ CONFLITO DE HORÁRIO — resolve na agenda (manter os dois ou mudar a hora):`
      );
      for (const conflict of applied.agenda_conflicts) {
        notificationLines.push(`   • ${conflict}`);
      }
    }
    if (applied.agenda_skipped.length > 0) {
      notificationLines.push(
        `❌ Compromissos que NÃO foram para a agenda: ${applied.agenda_skipped.join(" · ")}`
      );
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

    await sendPushToUser(supabaseAdmin, userId, {
      title: `🤖 IA analisou ${lead.name}`,
      body: applied.summary || notificationLines[0] || "Análise concluída.",
      url: "/leads",
      tag: `lead-analysis-${leadId}`,
    });

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
