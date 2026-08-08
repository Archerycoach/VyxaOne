import { supabase } from "@/integrations/supabase/client";
import { createEvent } from "@/services/calendarService";
import { buildLeadEventTitle } from "@/lib/leadEventTitle";
import { resolveFollowUpDate, type FollowUpChoice } from "@/lib/followUpSchedule";

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  call: "Chamada",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meeting: "Reunião",
  sms: "SMS",
  note: "Nota",
  visit: "Visita",
  other: "Outro",
};

/** Uma linha de histórico curta, para a descrição do evento de follow-up. */
export interface FollowUpHistoryEntry {
  interaction_type: string;
  content: string | null;
  interaction_date: string | null;
}

function formatHistoryLine(entry: FollowUpHistoryEntry): string {
  const label = INTERACTION_TYPE_LABELS[entry.interaction_type] || entry.interaction_type;
  const date = entry.interaction_date
    ? new Date(entry.interaction_date).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })
    : "";
  const content = (entry.content || "").replace(/<[^>]*>?/g, " ").replace(/\s+/g, " ").trim();
  const snippet = content.length > 140 ? `${content.slice(0, 140)}…` : content;
  return `• ${[date, label].filter(Boolean).join(" · ")}${snippet ? `: ${snippet}` : ""}`;
}

/**
 * Agenda o follow-up de uma lead, a seguir a uma interação acabada de
 * registar. Cria um evento "Follow-up - Nome" na agenda, com a interação e um
 * resumo do histórico recente na descrição — para quando o consultor abrir o
 * evento não ter de voltar à ficha para se lembrar do que se passou.
 *
 * Nunca é chamado sozinho — a interação já foi gravada por quem chama; isto é
 * só o passo seguinte, e uma falha aqui não deve derrubar o registo da
 * interação (quem chama decide como reagir a um erro).
 */
export async function scheduleLeadFollowUp(params: {
  leadId: string;
  leadName: string;
  choice: FollowUpChoice;
  customDate?: string;
  /** A interação que acabou de ser registada — aparece em destaque na descrição. */
  justLogged: FollowUpHistoryEntry;
  /** Últimas interações anteriores a esta, mais recente primeiro (opcional). */
  recentHistory?: FollowUpHistoryEntry[];
}): Promise<void> {
  const { leadId, leadName, choice, customDate, justLogged, recentHistory = [] } = params;

  const startTime = resolveFollowUpDate(choice, customDate);
  if (!startTime) return; // "Sem follow-up", ou personalizado sem data escolhida.

  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // bloco de 30min

  const historyLines = recentHistory.slice(0, 3).map(formatHistoryLine);

  const description = [
    `Follow-up de ${leadName}.`,
    "",
    `Última interação (${INTERACTION_TYPE_LABELS[justLogged.interaction_type] || justLogged.interaction_type}):`,
    (justLogged.content || "").replace(/<[^>]*>?/g, " ").replace(/\s+/g, " ").trim() || "(sem notas)",
    ...(historyLines.length > 0 ? ["", "Histórico recente:", ...historyLines] : []),
  ].join("\n");

  // createEvent nunca define user_id sozinho — cabe sempre a quem chama
  // (mesmo padrão de QuickEventDialog.tsx). Sem isto, a política de segurança
  // da tabela recusa a linha (user_id ficaria por preencher).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Volta a entrar.");

  await createEvent({
    title: buildLeadEventTitle("followup", leadName),
    description,
    lead_id: leadId,
    event_type: "followup",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    user_id: user.id,
  } as any);
}
