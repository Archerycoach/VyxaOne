import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lembretes do assistente de emails do PRÓPRIO consultor.
 *
 * Lê/atualiza via service-role (limitado ao user autenticado pelo token), para
 * não depender do RLS no cliente — a BD viva diverge das migrações e a policy
 * de SELECT pode não estar efetiva. A escrita (cron/run-now) já é server-side;
 * isto alinha a leitura e a mudança de estado.
 *
 * GET  -> { items: InboxTriageItem[] }
 * POST -> { id, status } atualiza o estado de um lembrete
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Não autorizado" });

  // `inbox_triage` não está nos tipos gerados — usa cliente destipado (as any).
  const db = supabaseAdmin as any;

  try {
    if (req.method === "GET") {
      const includeHandled = req.query.includeHandled === "true";
      let query = db
        .from("inbox_triage")
        .select("id, from_name, importance, urgency, intent, sender_kind, reminder, advice, agenda_suggestion, lead_id, status, created_at, email_subject, email_body")
        .eq("user_id", user.id);

      if (!includeHandled) query = query.eq("status", "new");

      const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;

      const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const items = ((data || []) as any[]).sort(
        (a, b) => (rank[a.importance] ?? 1) - (rank[b.importance] ?? 1),
      );
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const { id, status } = req.body || {};
      if (!id || !["new", "handled", "dismissed"].includes(status)) {
        return res.status(400).json({ error: "Parâmetros inválidos (id, status)." });
      }

      // Lê o remetente (hash) do lembrete antes de atualizar — para aprendizagem.
      const { data: row } = await db
        .from("inbox_triage")
        .select("sender_hash")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      // Limita ao próprio: só atualiza se a linha for do user autenticado.
      const { error } = await db
        .from("inbox_triage")
        .update({ status })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;

      // APRENDIZAGEM: conta "tratado"/"ignorado" por remetente (não conta o
      // voltar a "new"). Read-modify-write simples — sem corridas relevantes
      // (é o próprio consultor a clicar).
      const senderHash = (row as any)?.sender_hash as string | undefined;
      if (senderHash && (status === "handled" || status === "dismissed")) {
        const { data: stat } = await db
          .from("inbox_sender_stats")
          .select("handled_count, dismissed_count")
          .eq("user_id", user.id)
          .eq("sender_hash", senderHash)
          .maybeSingle();
        const handled = ((stat as any)?.handled_count || 0) + (status === "handled" ? 1 : 0);
        const dismissed = ((stat as any)?.dismissed_count || 0) + (status === "dismissed" ? 1 : 0);
        await db.from("inbox_sender_stats").upsert(
          { user_id: user.id, sender_hash: senderHash, handled_count: handled, dismissed_count: dismissed, updated_at: new Date().toISOString() },
          { onConflict: "user_id,sender_hash" },
        );
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error: any) {
    console.error("[inbox-assistant/items] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao obter lembretes." });
  }
}
