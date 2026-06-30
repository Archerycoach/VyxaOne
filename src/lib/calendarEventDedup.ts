export interface CalendarEventSignatureInput {
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  lead_id?: string | null;
}

export interface CalendarEventDedupCandidate extends CalendarEventSignatureInput {
  title: string;
  start_time: string;
  end_time: string;
}

/**
 * Calendar Event Deduplication Logic
 * Last verified: 2026-06-27T10:42:00Z
 * 
 * Rule: One event per lead per day (regardless of time)
 * Signature format:
 * - With lead: "lead_id::YYYY-MM-DD"
 * - No lead: "no-lead::normalized-title::YYYY-MM-DD"
 */

function normalizeTitle(title?: string | null): string {
  return (title || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  // Remove os segundos e milissegundos para a comparação não falhar por diferenças mínimas de arredondamento da IA
  parsedDate.setSeconds(0, 0);
  return parsedDate.toISOString();
}

function extractDateOnly(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  // Extrai apenas o YYYY-MM-DD para bloquear duplicações da mesma lead no mesmo dia
  return parsedDate.toISOString().split('T')[0];
}

export function buildCalendarEventSignature(
  event: CalendarEventSignatureInput,
): string | null {
  const dateOnly = extractDateOnly(event.start_time);

  if (!dateOnly) {
    return null;
  }

  // Regra Forte: Um evento por Lead por Dia!
  if (event.lead_id) {
    return `${event.lead_id}::${dateOnly}`;
  }

  // Se for um evento sem Lead (ex: Tarefa pessoal), bloqueamos se tiver o mesmo título no mesmo dia
  const normalizedTitle = (event.title || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalizedTitle) {
    return null;
  }

  return `no-lead::${normalizedTitle}::${dateOnly}`;
}

export function dedupeCalendarEventCandidates<T extends CalendarEventDedupCandidate>(
  candidateEvents: T[],
  existingEvents: CalendarEventSignatureInput[],
): {
  uniqueEvents: T[];
  skippedDuplicates: number;
  skippedInvalid: number;
} {
  const seenSignatures = new Set<string>();
  const uniqueEvents: T[] = [];
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  existingEvents.forEach((event) => {
    const signature = buildCalendarEventSignature(event);

    if (signature) {
      seenSignatures.add(signature);
    }
  });

  candidateEvents.forEach((event) => {
    const signature = buildCalendarEventSignature(event);

    if (!signature || !event.start_time || !event.end_time) {
      skippedInvalid += 1;
      return;
    }

    if (seenSignatures.has(signature)) {
      skippedDuplicates += 1;
      return;
    }

    seenSignatures.add(signature);
    uniqueEvents.push({
      ...event,
      start_time: event.start_time,
      end_time: event.end_time,
    });
  });

  return {
    uniqueEvents,
    skippedDuplicates,
    skippedInvalid,
  };
}