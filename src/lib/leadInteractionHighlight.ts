const FIVE_DAYS_IN_MS = 5 * 24 * 60 * 60 * 1000;

export interface LeadRecentInteractionState {
  isHighlighted: boolean;
  badgeLabel: string | null;
}

export function getLeadRecentInteractionState(
  lastContactDate: string | null | undefined,
): LeadRecentInteractionState {
  if (!lastContactDate) {
    return {
      isHighlighted: false,
      badgeLabel: null,
    };
  }

  const lastContactTimestamp = new Date(lastContactDate).getTime();

  if (Number.isNaN(lastContactTimestamp)) {
    return {
      isHighlighted: false,
      badgeLabel: null,
    };
  }

  const interactionAge = Date.now() - lastContactTimestamp;

  if (interactionAge < 0 || interactionAge > FIVE_DAYS_IN_MS) {
    return {
      isHighlighted: false,
      badgeLabel: null,
    };
  }

  return {
    isHighlighted: true,
    badgeLabel: "Interação recente",
  };
}