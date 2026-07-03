import { supabase } from "@/integrations/supabase/client";

const MIN_SAMPLE_SIZE = 3; // abaixo disto, a taxa por categoria não é fiável — usa a taxa geral em vez disso

interface HistoricalLead {
  status: string | null;
  source: string | null;
  budget_max: number | null;
  buy_purpose: string | null;
}

export interface ConversionRateBreakdown {
  overallRate: number;
  bySource: Record<string, { rate: number; sampleSize: number }>;
  byBudgetBucket: Record<string, { rate: number; sampleSize: number }>;
  byBuyPurpose: Record<string, { rate: number; sampleSize: number }>;
}

export interface ConversionProbabilityResult {
  probability: number; // 0-100
  factors: {
    source: { value: string | null; rate: number; sampleSize: number };
    budgetBucket: { value: string; rate: number; sampleSize: number };
    buyPurpose: { value: string | null; rate: number; sampleSize: number };
    overallRate: number;
  };
  hasEnoughData: boolean;
}

function budgetBucket(budgetMax: number | null): string {
  if (!budgetMax) return "desconhecido";
  if (budgetMax < 150000) return "<150k";
  if (budgetMax < 300000) return "150k-300k";
  if (budgetMax < 500000) return "300k-500k";
  if (budgetMax < 800000) return "500k-800k";
  return "800k+";
}

function computeRate(won: number, total: number): number {
  return total > 0 ? Math.round((won / total) * 100) : 0;
}

/**
 * Analisa todo o histórico de leads do consultor (fechadas com sucesso vs
 * todas as outras que já saíram do funil) e calcula a taxa de conversão
 * real por origem, por escalão de orçamento, e por objetivo da compra.
 * Esta é a base do scoring preditivo — em vez de pesos fixos e arbitrários,
 * usa o que realmente aconteceu no histórico deste consultor em concreto.
 */
export async function calculateHistoricalConversionRates(userId: string, supabaseClient = supabase): Promise<ConversionRateBreakdown> {
  const { data, error } = await supabaseClient
    .from("leads")
    .select("status, source, budget_max, buy_purpose")
    .eq("user_id", userId)
    .in("status", ["won", "lost"]); // só leads com desfecho definido — leads ainda ativas não contam para o histórico

  if (error || !data || data.length === 0) {
    return { overallRate: 0, bySource: {}, byBudgetBucket: {}, byBuyPurpose: {} };
  }

  const leads = data as HistoricalLead[];
  const totalWon = leads.filter((l) => l.status === "won").length;
  const overallRate = computeRate(totalWon, leads.length);

  const groupAndRate = <K extends string>(keyFn: (lead: HistoricalLead) => K | null): Record<string, { rate: number; sampleSize: number }> => {
    const groups = new Map<string, { won: number; total: number }>();
    for (const lead of leads) {
      const key = keyFn(lead);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { won: 0, total: 0 });
      const g = groups.get(key)!;
      g.total++;
      if (lead.status === "won") g.won++;
    }
    const result: Record<string, { rate: number; sampleSize: number }> = {};
    for (const [key, g] of groups.entries()) {
      result[key] = { rate: computeRate(g.won, g.total), sampleSize: g.total };
    }
    return result;
  };

  return {
    overallRate,
    bySource: groupAndRate((l) => l.source),
    byBudgetBucket: groupAndRate((l) => budgetBucket(l.budget_max)),
    byBuyPurpose: groupAndRate((l) => l.buy_purpose),
  };
}

/**
 * Calcula a probabilidade de fecho de uma lead específica, combinando as
 * taxas históricas (origem, orçamento, objetivo) já calculadas. Categorias
 * com poucos dados (< MIN_SAMPLE_SIZE) usam a taxa geral em vez da taxa
 * específica, para não dar demasiado peso a uma amostra pequena e pouco
 * fiável.
 */
export function calculateConversionProbability(
  lead: { source: string | null; budget_max: number | null; buy_purpose: string | null },
  rates: ConversionRateBreakdown
): ConversionProbabilityResult {
  const bucket = budgetBucket(lead.budget_max);

  const sourceData = (lead.source && rates.bySource[lead.source]?.sampleSize >= MIN_SAMPLE_SIZE)
    ? rates.bySource[lead.source]
    : { rate: rates.overallRate, sampleSize: lead.source ? (rates.bySource[lead.source]?.sampleSize || 0) : 0 };

  const budgetData = (rates.byBudgetBucket[bucket]?.sampleSize >= MIN_SAMPLE_SIZE)
    ? rates.byBudgetBucket[bucket]
    : { rate: rates.overallRate, sampleSize: rates.byBudgetBucket[bucket]?.sampleSize || 0 };

  const purposeData = (lead.buy_purpose && rates.byBuyPurpose[lead.buy_purpose]?.sampleSize >= MIN_SAMPLE_SIZE)
    ? rates.byBuyPurpose[lead.buy_purpose]
    : { rate: rates.overallRate, sampleSize: lead.buy_purpose ? (rates.byBuyPurpose[lead.buy_purpose]?.sampleSize || 0) : 0 };

  // Média simples das três dimensões — cada uma já "protegida" pela taxa
  // geral quando não há dados suficientes, por isso não é preciso pesar
  // de forma mais complexa.
  const probability = Math.round((sourceData.rate + budgetData.rate + purposeData.rate) / 3);

  const totalHistoricalSamples = Object.values(rates.bySource).reduce((sum, s) => sum + s.sampleSize, 0);

  return {
    probability,
    factors: {
      source: { value: lead.source, rate: sourceData.rate, sampleSize: sourceData.sampleSize },
      budgetBucket: { value: bucket, rate: budgetData.rate, sampleSize: budgetData.sampleSize },
      buyPurpose: { value: lead.buy_purpose, rate: purposeData.rate, sampleSize: purposeData.sampleSize },
      overallRate: rates.overallRate,
    },
    hasEnoughData: totalHistoricalSamples >= 10,
  };
}

/**
 * Recalcula e grava a probabilidade de fecho de uma lead específica.
 */
export async function updateLeadConversionProbability(leadId: string, userId: string, supabaseClient = supabase): Promise<ConversionProbabilityResult | null> {
  const { data: lead } = await supabaseClient
    .from("leads")
    .select("source, budget_max, buy_purpose")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return null;

  const rates = await calculateHistoricalConversionRates(userId, supabaseClient);
  const result = calculateConversionProbability(lead as any, rates);

  await (supabaseClient.from("leads") as any)
    .update({
      conversion_probability: result.hasEnoughData ? result.probability : null,
      conversion_probability_factors: result.factors,
      conversion_probability_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  return result;
}
