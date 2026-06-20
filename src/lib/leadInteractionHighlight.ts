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

  // Allow up to 24 hours in the future to account for client/server clock skew
  if (interactionAge < -86400000 || interactionAge > FIVE_DAYS_IN_MS) {
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