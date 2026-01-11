import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

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

export async function getBuyerStages(): Promise<PipelineStage[]> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pipeline_stages_buyers")
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    
    return data ? (data.value as unknown as PipelineStage[]) : DEFAULT_BUYER_STAGES;
  } catch (error) {
    console.error("Error fetching buyer stages:", error);
    return DEFAULT_BUYER_STAGES;
  }
}

export async function getSellerStages(): Promise<PipelineStage[]> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pipeline_stages_sellers")
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    
    return data ? (data.value as unknown as PipelineStage[]) : DEFAULT_SELLER_STAGES;
  } catch (error) {
    console.error("Error fetching seller stages:", error);
    return DEFAULT_SELLER_STAGES;
  }
}

export async function saveBuyerStages(stages: PipelineStage[]): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      key: "pipeline_stages_buyers",
      value: stages as any,
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });

  if (error) throw error;
}

export async function saveSellerStages(stages: PipelineStage[]): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      key: "pipeline_stages_sellers",
      value: stages as any,
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });

  if (error) throw error;
}