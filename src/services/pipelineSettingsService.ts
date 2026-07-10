import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

type StageType = "buyer" | "seller";

const DEFAULT_BUYER_STAGES: PipelineStage[] = [
  { id: "new", name: "Nova Lead", color: "#3B82F6" },
  { id: "qualified", name: "Qualificada", color: "#10B981" },
  { id: "visit", name: "Visita Agendada", color: "#8B5CF6" },
  { id: "proposal", name: "Proposta", color: "#F59E0B" },
  { id: "negotiation", name: "Negociação", color: "#EF4444" },
  { id: "closed", name: "Fechado", color: "#059669" },
];

const DEFAULT_SELLER_STAGES: PipelineStage[] = [
  { id: "new-contact", name: "Novo Contacto", color: "#3B82F6" },
  { id: "evaluation", name: "Avaliação", color: "#10B981" },
  { id: "documentation", name: "Documentação", color: "#8B5CF6" },
  { id: "marketing", name: "Marketing", color: "#F59E0B" },
  { id: "negotiation", name: "Negociação", color: "#EF4444" },
  { id: "sold", name: "Vendido", color: "#059669" },
];

function defaultsFor(stageType: StageType): PipelineStage[] {
  return stageType === "buyer" ? DEFAULT_BUYER_STAGES : DEFAULT_SELLER_STAGES;
}

// As fases do pipeline são isoladas por consultor (ver migração
// pipeline_stage_settings). Sem "userId", assume-se o utilizador
// autenticado — é o comportamento certo para o próprio consultor a gerir
// as suas fases, e um fallback aceitável (embora sem escala comum) para
// ecrãs agregados como o Dashboard/Funil quando não há um agente específico
// selecionado.
async function getStagesForUser(userId: string | undefined, stageType: StageType): Promise<PipelineStage[]> {
  try {
    let ownerId = userId;
    if (!ownerId) {
      const { data } = await supabase.auth.getUser();
      ownerId = data.user?.id;
    }
    if (!ownerId) return defaultsFor(stageType);

    const { data, error } = await supabase
      .from("pipeline_stage_settings" as any)
      .select("stages")
      .eq("user_id", ownerId)
      .eq("stage_type", stageType)
      .maybeSingle();

    if (error) throw error;

    const stages = (data as any)?.stages as PipelineStage[] | undefined;
    return stages && stages.length > 0 ? stages : defaultsFor(stageType);
  } catch (error) {
    console.error(`Error fetching ${stageType} stages:`, error);
    return defaultsFor(stageType);
  }
}

async function saveStagesForCurrentUser(stages: PipelineStage[], stageType: StageType): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("Sessão inválida");

  const { error } = await supabase
    .from("pipeline_stage_settings" as any)
    .upsert(
      { user_id: userId, stage_type: stageType, stages: stages as any, updated_at: new Date().toISOString() },
      { onConflict: "user_id,stage_type" }
    );

  if (error) throw error;
}

export async function getBuyerStages(userId?: string): Promise<PipelineStage[]> {
  return getStagesForUser(userId, "buyer");
}

export async function getSellerStages(userId?: string): Promise<PipelineStage[]> {
  return getStagesForUser(userId, "seller");
}

export async function saveBuyerStages(stages: PipelineStage[]): Promise<void> {
  return saveStagesForCurrentUser(stages, "buyer");
}

export async function saveSellerStages(stages: PipelineStage[]): Promise<void> {
  return saveStagesForCurrentUser(stages, "seller");
}

// Carrega as fases de vários donos de leads de uma só vez (ex.: uma grelha
// de leads da equipa, com leads de vários consultores em simultâneo) —
// evita N pedidos individuais.
export async function getStagesForUsers(userIds: string[], stageType: StageType): Promise<Record<string, PipelineStage[]>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const result: Record<string, PipelineStage[]> = {};
  if (uniqueIds.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from("pipeline_stage_settings" as any)
      .select("user_id, stages")
      .eq("stage_type", stageType)
      .in("user_id", uniqueIds);

    if (error) throw error;

    const byUser = new Map<string, PipelineStage[]>(
      (data || []).map((row: any) => [row.user_id as string, row.stages as PipelineStage[]])
    );

    for (const id of uniqueIds) {
      const stages = byUser.get(id);
      result[id] = stages && stages.length > 0 ? stages : defaultsFor(stageType);
    }
  } catch (error) {
    console.error(`Error fetching ${stageType} stages for users:`, error);
    for (const id of uniqueIds) result[id] = defaultsFor(stageType);
  }

  return result;
}
