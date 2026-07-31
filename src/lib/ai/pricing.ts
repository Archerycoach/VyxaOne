/**
 * AI Model Pricing Table
 * Prices are per 1M tokens (input/output), in USD.
 * Fontes oficiais/agregadores consultados em Julho 2026 — os preços das APIs
 * mudam com frequência; confirmar antes de decisões de faturação. Alguns
 * valores mais recentes são aproximados (marcados com "// aprox").
 */

export interface ModelPricing {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ---- OpenAI ----
  "gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 }, // aprox
  "gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-4": { inputPer1M: 30.0, outputPer1M: 60.0 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },

  // ---- Anthropic (Claude) ----
  "claude-opus-5": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-fable-5": { inputPer1M: 10.0, outputPer1M: 50.0 },
  "claude-sonnet-5": { inputPer1M: 2.0, outputPer1M: 10.0 }, // promo até 31/08/2026
  "claude-haiku-4-5": { inputPer1M: 1.0, outputPer1M: 5.0 },
  // Famílias 4.x (estimativas alinhadas ao tier atual — confirmar)
  "claude-opus-4-8": { inputPer1M: 5.0, outputPer1M: 25.0 }, // aprox
  "claude-opus-4": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-sonnet-4": { inputPer1M: 3.0, outputPer1M: 15.0 },
  // Legado 3.x
  "claude-3-5-sonnet-20241022": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4.0 },
  "claude-3-opus-20240229": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-3-sonnet-20240229": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },

  // ---- Google Gemini ----
  "gemini-3-pro": { inputPer1M: 2.0, outputPer1M: 12.0 },
  "gemini-3.1-pro": { inputPer1M: 2.0, outputPer1M: 12.0 },
  "gemini-3-flash": { inputPer1M: 0.25, outputPer1M: 1.5 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 }, // aprox
  "gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 }, // aprox
  "gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-1.0-pro": { inputPer1M: 0.5, outputPer1M: 1.5 },

  // ---- DeepSeek ----
  "deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.1 }, // aprox
  "deepseek-reasoner": { inputPer1M: 0.55, outputPer1M: 2.19 }, // aprox
};

/**
 * Encontra o preço de um modelo. Tenta correspondência exata; se falhar, tenta
 * o prefixo mais longo que corresponda (ex.: "claude-haiku-4-5-20251001" cai em
 * "claude-haiku-4-5"). Assim, IDs com sufixo de data continuam a ter preço.
 */
export function findPricing(model: string): ModelPricing | null {
  if (!model) return null;
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  let best: { key: string; pricing: ModelPricing } | null = null;
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, pricing };
    }
  }
  return best?.pricing ?? null;
}

/**
 * Calculate estimated cost (USD) for a given usage.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = findPricing(model);

  if (!pricing) {
    console.warn(`No pricing data for model: ${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}
