/**
 * Espinha de ações da IA: proposta → aprovação → execução → registo.
 *
 * Toda a ação que a IA queira fazer passa por aqui. Consoante o nível
 * configurado pelo consultor para essa capacidade, a ação é:
 *   - 'off'     → descartada (nem sequer é registada como proposta);
 *   - 'propose' → gravada como proposta pendente, à espera de aprovação;
 *   - 'auto'    → executada de imediato, mas na mesma registada.
 *
 * Em qualquer dos casos fica registo do que aconteceu, com o estado anterior,
 * para que o consultor possa auditar e reverter.
 */

import { buildLeadEventTitle } from "@/lib/leadEventTitle";

export type AiCapability =
  | "lead_qualification"
  | "lead_temperature"
  | "lead_status"
  | "task_create"
  | "calendar_block";

export type AiCapabilityLevel = "off" | "propose" | "auto";

export type AiActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_applied"
  | "failed"
  | "reverted";

/**
 * Níveis por omissão.
 *
 * Regra acordada: o trabalho interno do CRM (qualificação, temperatura, fase,
 * tarefas) corre em automático — a segurança vem do registo e do Desfazer, não
 * de travar o consultor a cada passo. Quem quiser mais controlo põe a
 * capacidade em "Propor" ou "Desligado" nas definições.
 *
 * Os blocos de agenda ficam em "Propor" porque já têm o seu próprio fluxo de
 * confirmação no calendário (ai_pending).
 *
 * Ações que saem para o cliente (email, SMS, WhatsApp) nunca são automáticas —
 * não estão sequer nesta lista.
 */
export const DEFAULT_CAPABILITY_LEVELS: Record<AiCapability, AiCapabilityLevel> = {
  lead_qualification: "auto", // só preenche campos vazios
  lead_temperature: "auto",
  lead_status: "auto",
  task_create: "auto",
  calendar_block: "propose",
};

export const CAPABILITY_LABELS: Record<AiCapability, string> = {
  lead_qualification: "Preencher qualificação em falta",
  lead_temperature: "Alterar a temperatura da lead",
  lead_status: "Alterar a fase da lead",
  task_create: "Criar tarefas",
  calendar_block: "Criar blocos na agenda",
};

export const CAPABILITY_DESCRIPTIONS: Record<AiCapability, string> = {
  lead_qualification:
    "Preenche apenas campos que estejam vazios (tipologia, orçamento, zona…). Nunca sobrepõe o que já preencheste.",
  lead_temperature: "Reavalia se a lead está quente, morna ou fria com base no que foi registado.",
  lead_status: "Move a lead para outra fase do pipeline quando a conversa o justifica.",
  task_create: "Cria tarefas de seguimento (ligar, enviar informação, remarcar).",
  calendar_block: "Marca blocos na agenda para visitas, chamadas ou reuniões.",
};

/** Resolve o nível de uma capacidade a partir do jsonb do perfil. */
export function getCapabilityLevel(
  capabilityLevels: unknown,
  capability: AiCapability
): AiCapabilityLevel {
  const levels = (capabilityLevels || {}) as Record<string, unknown>;
  const value = levels[capability];
  if (value === "off" || value === "propose" || value === "auto") {
    return value;
  }
  return DEFAULT_CAPABILITY_LEVELS[capability];
}

export interface RecordAiActionParams {
  supabaseAdmin: any;
  userId: string;
  capability: AiCapability;
  level: AiCapabilityLevel;
  entityType: "lead" | "task" | "calendar_event";
  entityId?: string | null;
  leadId?: string | null;
  /** Frase curta que o consultor lê na caixa de entrada. */
  title: string;
  reason?: string | null;
  /** O que despoletou (ex.: "nota", "interação", "cron buyer-match"). */
  source?: string | null;
  /** O que aplicar — interpretado por applyAiAction consoante a capacidade. */
  payload: Record<string, unknown>;
  /** Estado anterior, para poder reverter. */
  previousState?: Record<string, unknown> | null;
}

/**
 * Regista uma ação da IA e, se o nível for 'auto', executa-a de imediato.
 * Devolve o id da ação (ou null se a capacidade estiver desligada).
 *
 * Nunca lança: uma falha a registar/aplicar não pode partir o fluxo que a
 * despoletou (criar uma nota, correr um cron).
 */
export async function recordAiAction(
  params: RecordAiActionParams
): Promise<{ id: string | null; applied: boolean }> {
  const {
    supabaseAdmin,
    userId,
    capability,
    level,
    entityType,
    entityId,
    leadId,
    title,
    reason,
    source,
    payload,
    previousState,
  } = params;

  if (level === "off") {
    return { id: null, applied: false };
  }

  try {
    const isAuto = level === "auto";
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("ai_actions")
      .insert({
        user_id: userId,
        capability,
        status: isAuto ? "auto_applied" : "pending",
        entity_type: entityType,
        entity_id: entityId || null,
        lead_id: leadId || null,
        title,
        reason: reason || null,
        source: source || null,
        payload,
        previous_state: previousState || null,
        applied_at: isAuto ? now : null,
      })
      .select()
      .single();

    if (error) {
      console.error("[aiActions] Erro ao registar ação:", error);
      return { id: null, applied: false };
    }

    if (!isAuto) {
      return { id: data.id, applied: false };
    }

    // Nível 'auto' — executa já.
    const result = await applyAiAction({ supabaseAdmin, action: data });
    return { id: data.id, applied: result.ok };
  } catch (err) {
    console.error("[aiActions] Falha inesperada ao registar ação:", err);
    return { id: null, applied: false };
  }
}

export interface AiActionRow {
  id: string;
  user_id: string;
  capability: AiCapability;
  status: AiActionStatus;
  entity_type: string;
  entity_id: string | null;
  lead_id: string | null;
  title: string;
  reason: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  previous_state: Record<string, unknown> | null;
}

/**
 * Executa uma ação já registada. Usa service role — quem chama tem de ter
 * validado que a ação pertence ao utilizador.
 */
export async function applyAiAction(params: {
  supabaseAdmin: any;
  action: AiActionRow;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin, action } = params;

  try {
    let result: Record<string, unknown> = {};

    switch (action.capability) {
      case "lead_qualification":
      case "lead_temperature":
      case "lead_status": {
        if (!action.lead_id) return await failAction(supabaseAdmin, action, "sem lead associada");
        const updates = (action.payload?.updates || {}) as Record<string, unknown>;
        if (Object.keys(updates).length === 0) {
          return await failAction(supabaseAdmin, action, "sem alterações a aplicar");
        }
        const { error } = await supabaseAdmin
          .from("leads")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", action.lead_id)
          .eq("user_id", action.user_id);
        if (error) return await failAction(supabaseAdmin, action, error.message);

        await logLeadActivity(supabaseAdmin, action, updates);
        result = { updated_fields: Object.keys(updates) };
        break;
      }

      case "task_create": {
        const task = (action.payload?.task || {}) as Record<string, unknown>;
        const { data, error } = await supabaseAdmin
          .from("tasks")
          .insert({
            user_id: action.user_id,
            related_lead_id: action.lead_id,
            title: task.title,
            description: task.description || null,
            due_date: task.due_date || null,
            priority: task.priority || "medium",
            status: "pending",
          })
          .select()
          .single();
        if (error) return await failAction(supabaseAdmin, action, error.message);
        result = { task_id: data.id };
        break;
      }

      case "calendar_block": {
        const event = (action.payload?.event || {}) as Record<string, unknown>;

        // Título uniforme "Tema - Nome da lead" (ex.: "Chamada - David
        // Esteves"), como em todos os outros fluxos que criam eventos a partir
        // de uma lead. O título original da IA vai para a descrição.
        let eventTitle = String(event.title || "Evento");
        let eventDescription = (event.description as string) || null;

        if (action.lead_id) {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("name")
            .eq("id", action.lead_id)
            .maybeSingle();

          if (lead?.name) {
            const original = eventTitle;
            eventTitle = buildLeadEventTitle(String(event.event_type || "meeting"), lead.name);
            if (original && original !== eventTitle) {
              eventDescription = [original, eventDescription].filter(Boolean).join("\n\n");
            }
          }
        }

        const { data, error } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            user_id: action.user_id,
            lead_id: action.lead_id,
            title: eventTitle,
            description: eventDescription,
            start_time: event.start_time,
            end_time: event.end_time,
            event_type: event.event_type || "meeting",
            ai_pending: false,
          })
          .select()
          .single();
        if (error) return await failAction(supabaseAdmin, action, error.message);
        result = { event_id: data.id };
        break;
      }

      default:
        return await failAction(supabaseAdmin, action, `capacidade desconhecida: ${action.capability}`);
    }

    await supabaseAdmin
      .from("ai_actions")
      .update({
        applied_at: new Date().toISOString(),
        result,
        error: null,
      })
      .eq("id", action.id);

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return await failAction(supabaseAdmin, action, message);
  }
}

async function failAction(supabaseAdmin: any, action: AiActionRow, message: string) {
  console.error(`[aiActions] Falha ao aplicar ação ${action.id}:`, message);
  await supabaseAdmin
    .from("ai_actions")
    .update({ status: "failed", error: message })
    .eq("id", action.id);
  return { ok: false, error: message };
}

/**
 * Reverte uma ação já aplicada, usando o estado anterior guardado.
 * Alterações a leads voltam ao valor anterior; tarefas e eventos criados
 * pela IA são eliminados.
 */
export async function revertAiAction(params: {
  supabaseAdmin: any;
  action: AiActionRow & { result?: Record<string, unknown> | null };
}): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin, action } = params;

  try {
    switch (action.capability) {
      case "lead_qualification":
      case "lead_temperature":
      case "lead_status": {
        const previous = action.previous_state || {};
        if (!action.lead_id || Object.keys(previous).length === 0) {
          return { ok: false, error: "sem estado anterior guardado" };
        }
        const { error } = await supabaseAdmin
          .from("leads")
          .update({ ...previous, updated_at: new Date().toISOString() })
          .eq("id", action.lead_id)
          .eq("user_id", action.user_id);
        if (error) return { ok: false, error: error.message };
        break;
      }

      case "task_create": {
        const taskId = (action.result || {}).task_id as string | undefined;
        if (taskId) {
          await supabaseAdmin.from("tasks").delete().eq("id", taskId).eq("user_id", action.user_id);
        }
        break;
      }

      case "calendar_block": {
        const eventId = (action.result || {}).event_id as string | undefined;
        if (eventId) {
          await supabaseAdmin
            .from("calendar_events")
            .delete()
            .eq("id", eventId)
            .eq("user_id", action.user_id);
        }
        break;
      }
    }

    await supabaseAdmin
      .from("ai_actions")
      .update({ status: "reverted", reverted_at: new Date().toISOString() })
      .eq("id", action.id);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "erro desconhecido" };
  }
}

/**
 * Deixa rasto no histórico da lead, para as alterações da IA aparecerem no
 * mesmo sítio das alterações manuais.
 */
async function logLeadActivity(
  supabaseAdmin: any,
  action: AiActionRow,
  updates: Record<string, unknown>
) {
  try {
    const previous = action.previous_state || {};
    const rows = Object.entries(updates).map(([field, value]) => ({
      lead_id: action.lead_id,
      user_id: action.user_id,
      action: "updated",
      field_name: field,
      old_value: previous[field] === undefined || previous[field] === null ? null : String(previous[field]),
      new_value: value === null || value === undefined ? null : String(value),
    }));
    if (rows.length > 0) {
      await supabaseAdmin.from("lead_activity_log").insert(rows);
    }
  } catch (err) {
    // Best-effort: falhar o registo não deve reverter a alteração.
    console.error("[aiActions] Erro ao escrever no lead_activity_log:", err);
  }
}
