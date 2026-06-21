const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

// Outcomes que NÃO devem contar como contacto efetivo
const NEGATIVE_OUTCOMES = [
  "não atendeu",
  "nao atendeu",
  "não respondeu",
  "nao respondeu",
  "caixa de correio cheia",
  "sem resposta",
  "voicemail",
  "não disponível",
  "nao disponivel",
  "ocupado",
  "desligou",
];

export interface LeadRecentInteractionState {
  isHighlighted: boolean;
  badgeLabel: string | null;
}

export function getLeadRecentInteractionState(
  lastContactDate: string | null | undefined,
  lastContactOutcome?: string | null,
): LeadRecentInteractionState {
  if (!lastContactDate) {
    return {
      isHighlighted: false,
      badgeLabel: null,
    };
  }

  // Se o último contacto teve um outcome negativo, não destacar
  if (lastContactOutcome) {
    const normalizedOutcome = lastContactOutcome.toLowerCase().trim();
    if (NEGATIVE_OUTCOMES.some(negativeOutcome => normalizedOutcome.includes(negativeOutcome))) {
      return {
        isHighlighted: false,
        badgeLabel: null,
      };
    }
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
  if (interactionAge < -86400000 || interactionAge > SEVEN_DAYS_IN_MS) {
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