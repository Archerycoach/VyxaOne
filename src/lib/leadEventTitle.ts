/**
 * Título normalizado para eventos de agenda criados a partir de uma lead:
 * "Tema - Nome da lead" (ex.: "Chamada - David Santos").
 *
 * Usado por TODOS os fluxos que criam eventos ligados a uma lead no servidor
 * (análise automática de IA, assistente GPT, workflows), para a agenda ficar
 * uniforme e cada evento ser imediatamente identificável. O título "criativo"
 * de origem (da IA ou do template do workflow) vai para a descrição.
 */

export const LEAD_EVENT_TYPE_LABELS: Record<string, string> = {
  viewing: "Visita",
  visit: "Visita", // o dialog "Novo Evento para Lead" usa "visit"; o calendário usa "viewing"
  meeting: "Reunião",
  call: "Chamada",
  followup: "Follow-up",
  other: "Evento",
};

export function buildLeadEventTitle(eventType: string | null | undefined, leadName: string): string {
  const label = LEAD_EVENT_TYPE_LABELS[eventType || ""] || "Evento";
  return `${label} - ${leadName}`;
}

/**
 * Diz se um título ainda é um título gerado automaticamente para esta lead
 * (em qualquer tema, incluindo o formato antigo "Tema: Nome"). Usado pela UI
 * para saber se pode regenerar o título quando o tipo de evento muda — um
 * título personalizado pelo consultor nunca é substituído.
 */
export function isAutoLeadEventTitle(title: string | null | undefined, leadName: string): boolean {
  if (!title || !title.trim()) return true;
  return Object.values(LEAD_EVENT_TYPE_LABELS).some(
    (label) => title === `${label} - ${leadName}` || title === `${label}: ${leadName}`
  );
}
