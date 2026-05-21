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

export function buildCalendarEventSignature(
  event: CalendarEventSignatureInput,
): string | null {
  const normalizedTitle = normalizeTitle(event.title);
  const normalizedStartTime = normalizeDateTime(event.start_time);
  const normalizedEndTime = normalizeDateTime(event.end_time);

  if (!normalizedTitle || !normalizedStartTime || !normalizedEndTime) {
    return null;
  }

  return [
    event.lead_id || "no-lead",
    normalizedTitle,
    normalizedStartTime,
    normalizedEndTime,
  ].join("::");
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
    const normalizedStartTime = normalizeDateTime(event.start_time);
    const normalizedEndTime = normalizeDateTime(event.end_time);
    const signature = buildCalendarEventSignature({
      ...event,
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
    });

    if (!signature || !normalizedStartTime || !normalizedEndTime) {
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
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
    });
  });

  return {
    uniqueEvents,
    skippedDuplicates,
    skippedInvalid,
  };
}