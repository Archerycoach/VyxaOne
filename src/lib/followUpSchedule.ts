/**
 * Opções de "daqui a quanto tempo" para o follow-up de uma interação — usadas
 * pelo FollowUpPicker e por quem agenda o evento.
 */
export type FollowUpChoice = "none" | "tomorrow" | "3d" | "1w" | "2w" | "custom";

export const FOLLOW_UP_OPTIONS: Array<{ value: FollowUpChoice; label: string }> = [
  { value: "none", label: "Sem follow-up" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "3d", label: "Em 3 dias" },
  { value: "1w", label: "Em 1 semana" },
  { value: "2w", label: "Em 2 semanas" },
  { value: "custom", label: "Escolher data…" },
];

/** Hora por omissão do follow-up, quando o consultor não escolhe uma específica. */
const DEFAULT_HOUR = 10;

/**
 * Data/hora do follow-up a partir da escolha. `customDate` (YYYY-MM-DD) só é
 * usado quando choice === "custom". Devolve null para "none" ou uma escolha
 * personalizada sem data ainda preenchida.
 */
export function resolveFollowUpDate(choice: FollowUpChoice, customDate?: string): Date | null {
  if (choice === "none") return null;

  if (choice === "custom") {
    if (!customDate) return null;
    const [y, m, d] = customDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, DEFAULT_HOUR, 0, 0, 0);
  }

  const days = choice === "tomorrow" ? 1 : choice === "3d" ? 3 : choice === "1w" ? 7 : choice === "2w" ? 14 : null;
  if (days === null) return null;

  const date = new Date();
  date.setHours(DEFAULT_HOUR, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}
