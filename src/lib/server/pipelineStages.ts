/**
 * Fases do pipeline configuradas na instalação (system_settings.pipeline_stages).
 *
 * As fases são personalizáveis por agência, por isso não podem estar fixas no
 * código nem nos prompts: se a IA sugerir uma fase que não existe, a sugestão
 * é (corretamente) descartada e a capacidade fica muda. Estes defaults são os
 * mesmos do settingsService, para o comportamento ser igual no cliente e no
 * servidor.
 */

export const DEFAULT_PIPELINE_STAGES: Record<string, string[]> = {
  buyer: [
    "novo",
    "contactado",
    "qualificado",
    "visitas",
    "seguimento",
    "negociacao",
    "proposta",
    "fechado",
    "perdido",
  ],
  seller: [
    "novo",
    "contactado",
    "avaliacao",
    "seguimento",
    "negociacao",
    "listado",
    "vendido",
    "perdido",
  ],
};

/** Devolve as fases válidas para o tipo de uma lead ("buyer" | "seller"). */
export async function getPipelineStagesForLead(
  supabaseAdmin: any,
  leadType?: string | null
): Promise<string[]> {
  const key = leadType === "seller" ? "seller" : "buyer";

  try {
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "pipeline_stages")
      .maybeSingle();

    const configured = (data?.value || {}) as Record<string, unknown>;
    const stages = configured[key];

    if (Array.isArray(stages) && stages.length > 0) {
      return stages.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    }
  } catch (err) {
    console.error("[pipelineStages] Erro ao ler as fases configuradas:", err);
  }

  return DEFAULT_PIPELINE_STAGES[key];
}
