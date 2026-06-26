/**
 * AI Model Pricing Table (as of January 2026)
 * Prices are per 1M tokens (input/output)
 * Source: Official provider pricing pages
 */

export interface ModelPricing {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  "gpt-4o": {
    inputPer1M: 2.50,
    outputPer1M: 10.00,
  },
  "gpt-4o-mini": {
    inputPer1M: 0.15,
    outputPer1M: 0.60,
  },
  "gpt-4-turbo": {
    inputPer1M: 10.00,
    outputPer1M: 30.00,
  },
  "gpt-4": {
    inputPer1M: 30.00,
    outputPer1M: 60.00,
  },
  "gpt-3.5-turbo": {
    inputPer1M: 0.50,
    outputPer1M: 1.50,
  },

  // Anthropic Models (Claude)
  "claude-3-5-sonnet-20241022": {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
  "claude-3-5-haiku-20241022": {
    inputPer1M: 0.80,
    outputPer1M: 4.00,
  },
  "claude-3-opus-20240229": {
    inputPer1M: 15.00,
    outputPer1M: 75.00,
  },
  "claude-3-sonnet-20240229": {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
  "claude-3-haiku-20240307": {
    inputPer1M: 0.25,
    outputPer1M: 1.25,
  },

  // Google Gemini Models
  "gemini-1.5-pro": {
    inputPer1M: 1.25,
    outputPer1M: 5.00,
  },
  "gemini-1.5-flash": {
    inputPer1M: 0.075,
    outputPer1M: 0.30,
  },
  "gemini-1.0-pro": {
    inputPer1M: 0.50,
    outputPer1M: 1.50,
  },
};

/**
 * Calculate estimated cost for a given usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  
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