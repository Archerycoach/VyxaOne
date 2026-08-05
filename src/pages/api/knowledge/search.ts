import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchKnowledge } from "@/lib/server/knowledgeBase";

/**
 * Pesquisa na Base de Conhecimento.
 *
 * Serve o painel "Testar" da página: o consultor escreve uma pergunta e vê
 * exatamente que excertos é que a IA vai receber. Sem isto, a base de
 * conhecimento é uma caixa preta — e uma caixa preta não gera confiança.
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

  const { query, topK } = req.body as { query?: string; topK?: number };

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Escreve uma pergunta para testar." });
  }

  const matches = await searchKnowledge({
    userId: user.id,
    query: query.trim(),
    topK: typeof topK === "number" && topK > 0 && topK <= 20 ? topK : 6,
    supabase: supabaseAdmin,
  });

  return res.status(200).json({ matches });
}
