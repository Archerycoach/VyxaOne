import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { indexProperty } from "@/lib/server/propertySemanticSearch";

/**
 * Indexa imóveis para pesquisa semântica.
 *
 * Body:
 *   { propertyId }  → indexa um imóvel (chamado depois de criar/editar)
 *   { all: true }   → indexa toda a carteira do consultor (backfill inicial)
 *
 * Imóveis cujo conteúdo não mudou são ignorados, para não pagar duas vezes
 * pelo mesmo texto.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { propertyId, all } = req.body as { propertyId?: string; all?: boolean };

  try {
    if (propertyId) {
      const { data: property } = await supabaseAdmin
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!property) {
        return res.status(404).json({ error: "Imóvel não encontrado" });
      }

      const result = await indexProperty({ supabaseAdmin, property });
      return res.status(200).json({ success: true, ...result });
    }

    if (!all) {
      return res.status(400).json({ error: "Indica propertyId ou all: true" });
    }

    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("user_id", user.id);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const property of properties || []) {
      const result = await indexProperty({ supabaseAdmin, property });
      if (result.indexed) indexed++;
      else if (result.reason === "inalterado" || result.reason === "sem_conteudo") skipped++;
      else failed++;
    }

    return res.status(200).json({
      success: true,
      total: properties?.length || 0,
      indexed,
      skipped,
      failed,
    });
  } catch (error: any) {
    console.error("[index-embeddings] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao indexar imóveis." });
  }
}
