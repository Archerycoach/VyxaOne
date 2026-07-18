import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { applyAiAction, revertAiAction, type AiActionRow } from "@/lib/server/aiActions";

/**
 * Decide sobre ações propostas pela IA: aprovar, rejeitar ou reverter.
 *
 * Body: { ids: string[], decision: "approve" | "reject" | "revert" }
 *
 * Nunca confia no cliente: confirma sempre no servidor que cada ação pertence
 * ao utilizador autenticado antes de a executar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Sessão inválida" });
  }

  const body = (req.body || {}) as { ids?: unknown; decision?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  const decision = body.decision;

  if (ids.length === 0) {
    return res.status(400).json({ error: "Nenhuma ação indicada." });
  }
  if (decision !== "approve" && decision !== "reject" && decision !== "revert") {
    return res.status(400).json({ error: "Decisão inválida." });
  }

  // Revalidação de propriedade: só as ações DESTE utilizador.
  const { data: actions, error: fetchError } = await admin
    .from("ai_actions")
    .select("*")
    .in("id", ids)
    .eq("user_id", user.id);

  if (fetchError) {
    console.error("[ai-actions/decide] Erro ao carregar ações:", fetchError);
    return res.status(500).json({ error: "Não foi possível carregar as ações." });
  }
  if (!actions || actions.length === 0) {
    return res.status(404).json({ error: "Ações não encontradas." });
  }

  const now = new Date().toISOString();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const action of actions as AiActionRow[]) {
    if (decision === "reject") {
      if (action.status !== "pending") {
        results.push({ id: action.id, ok: false, error: "já decidida" });
        continue;
      }
      await admin
        .from("ai_actions")
        .update({ status: "rejected", decided_at: now, decided_by: user.id })
        .eq("id", action.id);
      results.push({ id: action.id, ok: true });
      continue;
    }

    if (decision === "approve") {
      if (action.status !== "pending") {
        results.push({ id: action.id, ok: false, error: "já decidida" });
        continue;
      }
      await admin
        .from("ai_actions")
        .update({ status: "approved", decided_at: now, decided_by: user.id })
        .eq("id", action.id);

      const outcome = await applyAiAction({ supabaseAdmin: admin, action });
      results.push({ id: action.id, ok: outcome.ok, error: outcome.error });
      continue;
    }

    // revert
    if (action.status !== "approved" && action.status !== "auto_applied") {
      results.push({ id: action.id, ok: false, error: "só é possível reverter ações aplicadas" });
      continue;
    }
    const outcome = await revertAiAction({ supabaseAdmin: admin, action });
    results.push({ id: action.id, ok: outcome.ok, error: outcome.error });
  }

  const succeeded = results.filter((r) => r.ok).length;
  return res.status(200).json({ succeeded, total: results.length, results });
}
