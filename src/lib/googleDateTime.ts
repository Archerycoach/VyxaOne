/**
 * Converte um instante (ISO com offset UTC, como vem da BD) para a hora LOCAL
 * de Lisboa, sem offset — o formato que a API do Google Calendar espera no
 * campo `dateTime` quando também se indica `timeZone`.
 *
 * Mandar o ISO com offset UTC (ex.: "…T16:00:00Z") junto com `timeZone:
 * "Europe/Lisbon"` faz o Google tratar os dígitos "16:00" como se já fossem
 * hora de Lisboa, ignorando o offset — o evento fica 1h à frente no verão
 * (WEST = UTC+1): uma chamada às 17h aparecia às 18h no Google. Mesma família
 * de bug que o formatLisbonDateTime de src/lib/ai/prompts/leadAutoAnalysis.ts
 * já corrigiu para os prompts da IA.
 *
 * Partilhado pelo cliente (src/lib/googleCalendar.ts) e pelo servidor
 * (src/pages/api/google-calendar/sync.ts) — a mesma conversão nos dois lados.
 */
export function toGoogleLisbonDateTime(isoString: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour; // meia-noite pode vir como "24"
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}
