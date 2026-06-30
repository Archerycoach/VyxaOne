import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, differenceInHours } from "date-fns";

/**
 * Sistema de Lead Scoring Comportamental 0-100
 * 
 * Componentes:
 * - Tempo médio de resposta do consultor: 20 pontos
 * - Número e recência de interações: 25 pontos
 * - Fit orçamento vs carteira disponível: 20 pontos
 * - Canal de origem: 15 pontos
 * - Dias desde último contacto: 20 pontos
 */

interface ScoreComponents {
  responseTimeScore: number;
  engagementScore: number;
  budgetFitScore: number;
  sourceScore: number;
  recencyScore: number;
  totalScore: number;
}

/**
 * Calcula o score comportamental de uma lead
 */
export const calculateLeadScore = async (
  leadId: string, 
  supabaseClient = supabase,
  triggerReason: string = "manual_recalc"
): Promise<number> => {
  try {
    const components = await calculateScoreComponents(leadId, supabaseClient);
    
    // Obter user_id da lead para guardar histórico
    const { data: lead } = await supabaseClient
      .from("leads")
      .select("user_id")
      .eq("id", leadId)
      .single();

    if (!lead) return 0;

    // Atualizar score na lead
    await supabaseClient
      .from("leads")
      .update({ score: components.totalScore })
      .eq("id", leadId);

    // Guardar histórico
    await (supabaseClient
      .from("lead_score_history" as any)
      .insert({
        lead_id: leadId,
        user_id: lead.user_id,
        score: components.totalScore,
        response_time_score: components.responseTimeScore,
        engagement_score: components.engagementScore,
        budget_fit_score: components.budgetFitScore,
        source_score: components.sourceScore,
        recency_score: components.recencyScore,
        trigger_reason: triggerReason,
      }) as any);

    return components.totalScore;
  } catch (error) {
    console.error("Error calculating lead score:", error);
    return 0;
  }
};

/**
 * Calcula cada componente do score
 */
async function calculateScoreComponents(
  leadId: string,
  supabaseClient = supabase
): Promise<ScoreComponents> {
  // Buscar lead e suas interações
  const { data: lead } = await supabaseClient
    .from("leads")
    .select("*, user_id, source, budget_min, budget_max, last_contact_date")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return {
      responseTimeScore: 0,
      engagementScore: 0,
      budgetFitScore: 0,
      sourceScore: 0,
      recencyScore: 0,
      totalScore: 0,
    };
  }

  // Buscar interações
  const { data: interactions } = await supabaseClient
    .from("interactions")
    .select("interaction_type, created_at, interaction_date")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);

  // 1. TEMPO MÉDIO DE RESPOSTA DO CONSULTOR (0-20 pontos)
  const responseTimeScore = calculateResponseTimeScore(interactions || []);

  // 2. NÚMERO E RECÊNCIA DE INTERAÇÕES (0-25 pontos)
  const engagementScore = calculateEngagementScore(interactions || []);

  // 3. FIT ORÇAMENTO VS CARTEIRA (0-20 pontos)
  const budgetFitScore = await calculateBudgetFitScore(lead, supabaseClient);

  // 4. CANAL DE ORIGEM (0-15 pontos)
  const sourceScore = calculateSourceScore(lead.source);

  // 5. DIAS DESDE ÚLTIMO CONTACTO (0-20 pontos)
  const recencyScore = calculateRecencyScore(lead.last_contact_date);

  const totalScore = Math.min(
    responseTimeScore + engagementScore + budgetFitScore + sourceScore + recencyScore,
    100
  );

  return {
    responseTimeScore,
    engagementScore,
    budgetFitScore,
    sourceScore,
    recencyScore,
    totalScore,
  };
}

/**
 * 1. Tempo médio de resposta do consultor (0-20)
 * Melhor = resposta em <24h = 20 pts
 * Médio = resposta em 24-48h = 10 pts
 * Lento = resposta >48h = 5 pts
 */
function calculateResponseTimeScore(interactions: any[]): number {
  const inboundInteractions = interactions.filter(i => 
    i.interaction_type?.includes("inbound") || i.interaction_type === "call"
  );

  if (inboundInteractions.length === 0) return 15; // Sem histórico = score neutro

  const responseTimes: number[] = [];

  for (let i = 0; i < inboundInteractions.length - 1; i++) {
    const inbound = inboundInteractions[i];
    // Procurar próxima outbound após esta inbound
    const nextOutbound = interactions.find(
      int => 
        (int.interaction_type?.includes("outbound") || int.interaction_type === "email") &&
        new Date(int.created_at) > new Date(inbound.created_at)
    );

    if (nextOutbound) {
      const hours = differenceInHours(
        new Date(nextOutbound.created_at),
        new Date(inbound.created_at)
      );
      responseTimes.push(hours);
    }
  }

  if (responseTimes.length === 0) return 15;

  const avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  if (avgResponseHours <= 24) return 20;
  if (avgResponseHours <= 48) return 15;
  if (avgResponseHours <= 72) return 10;
  return 5;
}

/**
 * 2. Número e recência de interações (0-25)
 * Quantidade (0-15): 10+ interações = 15, 5-9 = 10, 1-4 = 5
 * Recência (0-10): última interação <7 dias = 10, <14 = 7, <30 = 4
 */
function calculateEngagementScore(interactions: any[]): number {
  let score = 0;

  // Quantidade
  const count = interactions.length;
  if (count >= 10) score += 15;
  else if (count >= 5) score += 10;
  else if (count >= 1) score += 5;

  // Recência da última interação
  if (interactions.length > 0) {
    const lastInteraction = interactions[0];
    const daysSince = differenceInDays(new Date(), new Date(lastInteraction.created_at));
    
    if (daysSince <= 7) score += 10;
    else if (daysSince <= 14) score += 7;
    else if (daysSince <= 30) score += 4;
    else if (daysSince <= 60) score += 2;
  }

  return score;
}

/**
 * 3. Fit orçamento vs carteira disponível (0-20)
 * Existem imóveis no orçamento da lead = 20
 * Existem imóveis perto do orçamento (±20%) = 10
 * Nenhum match = 5
 */
async function calculateBudgetFitScore(
  lead: any,
  supabaseClient: any
): Promise<number> {
  if (!lead.budget_min && !lead.budget_max) return 10; // Sem orçamento definido = neutro

  const budget = lead.budget_max || lead.budget_min || 0;

  // Buscar imóveis do mesmo user dentro do orçamento (±20%)
  const { data: properties } = await supabaseClient
    .from("properties")
    .select("price")
    .eq("user_id", lead.user_id)
    .gte("price", budget * 0.8)
    .lte("price", budget * 1.2)
    .limit(1);

  if (!properties || properties.length === 0) return 5; // Nenhum match

  // Verificar se há match exato (dentro do orçamento)
  const exactMatches = properties.filter(p => 
    p.price >= (lead.budget_min || 0) && 
    p.price <= (lead.budget_max || budget * 1.2)
  );

  if (exactMatches.length > 0) return 20;
  return 10; // Match aproximado
}

/**
 * 4. Canal de origem (0-15)
 * Canais quentes (indicação, site) = 15
 * Canais médios (redes sociais, Meta Forms) = 10
 * Canais frios (outros) = 5
 */
function calculateSourceScore(source: string | null): number {
  if (!source) return 8;

  const hotSources = ["indicação", "referral", "site", "website"];
  const warmSources = ["meta", "facebook", "instagram", "linkedin", "whatsapp"];

  const lowerSource = source.toLowerCase();

  if (hotSources.some(s => lowerSource.includes(s))) return 15;
  if (warmSources.some(s => lowerSource.includes(s))) return 10;
  return 5;
}

/**
 * 5. Dias desde último contacto (0-20)
 * <3 dias = 20
 * 3-7 dias = 15
 * 7-14 dias = 10
 * 14-30 dias = 5
 * >30 dias = 0
 */
function calculateRecencyScore(lastContactDate: string | null): number {
  if (!lastContactDate) return 0;

  const daysSince = differenceInDays(new Date(), new Date(lastContactDate));

  if (daysSince <= 3) return 20;
  if (daysSince <= 7) return 15;
  if (daysSince <= 14) return 10;
  if (daysSince <= 30) return 5;
  return 0;
}

/**
 * Obtém histórico de score de uma lead
 */
export const getLeadScoreHistory = async (
  leadId: string,
  supabaseClient = supabase
): Promise<any[]> => {
  const { data, error } = await (supabaseClient
    .from("lead_score_history" as any)
    .select("*")
    .eq("lead_id", leadId)
    .order("calculated_at", { ascending: false })
    .limit(30) as any); // Últimos 30 registos

  if (error) {
    console.error("Error fetching score history:", error);
    return [];
  }

  return data || [];
};

/**
 * Calcula tendência do score (subindo/descendo/estável)
 */
export const getScoreTrend = (history: any[]): "up" | "down" | "stable" => {
  if (history.length < 2) return "stable";

  const current = history[0].score;
  const previous = history[1].score;

  if (current > previous + 5) return "up";
  if (current < previous - 5) return "down";
  return "stable";
};

/**
 * Recalcula score automaticamente após nova interação
 * Deve ser chamado nos hooks de criação de interação
 */
export const recalculateScoreAfterInteraction = async (
  leadId: string,
  supabaseClient = supabase
): Promise<void> => {
  try {
    await calculateLeadScore(leadId, supabaseClient, "new_interaction");
  } catch (error) {
    console.error("Error recalculating score after interaction:", error);
  }
};