import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Lista as ações da IA do consultor autenticado.
 *
 * ?status=pending  → só as que estão à espera de decisão (caixa de entrada)
 * ?status=history  → o que já foi feito/decidido (registo auditável)
 *
 * Usa o token do utilizador, por isso o RLS da tabela ai_actions garante que
 * cada consultor só vê as suas (e os gestores as da equipa).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const scope = typeof req.query.status === "string" ? req.query.status : "pending";
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  let query = supabase
    .from("ai_actions")
    .select("*, leads(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (scope === "pending") {
    query = query.eq("status", "pending");
  } else {
    query = query.neq("status", "pending");
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ai-actions] Erro ao listar:", error);
    return res.status(500).json({ error: "Não foi possível carregar as ações da IA." });
  }

  return res.status(200).json({ actions: data || [] });
}
