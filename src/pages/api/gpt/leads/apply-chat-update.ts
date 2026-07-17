import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { validateLeadUpdates, FIELD_LABELS } from "@/lib/server/leadChatUpdate";

/**
 * Aplica uma alteração de leads proposta pelo Agente IA, DEPOIS de o consultor
 * confirmar no ecrã. Nunca confia no cliente: revalida o allowlist de campos e
 * confirma (via RLS, cliente com o token do utilizador) que as leads são do
 * próprio. Regista uma interação por lead alterada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Sessão inválida" });
  }

  // Cliente com o token do utilizador → o RLS garante que só toca nas leads dele.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { targetLeadIds, updates: rawUpdates } = (req.body || {}) as {
    targetLeadIds?: unknown;
    updates?: Record<string, unknown>;
  };

  if (!Array.isArray(targetLeadIds) || targetLeadIds.length === 0) {
    return res.status(400).json({ error: "Sem leads alvo." });
  }

  // Revalidação do allowlist (o cliente pode ter sido adulterado).
  const updates = validateLeadUpdates(rawUpdates);
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nenhum campo válido para alterar." });
  }

  const ids = targetLeadIds.filter((id): id is string => typeof id === "string");

  try {
    // Confirmar posse: só as leads visíveis ao utilizador (RLS) são alteradas.
    const { data: ownedLeads, error: fetchError } = await supabase
      .from("leads")
      .select("id, name")
      .in("id", ids);

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    const ownedIds = (ownedLeads || []).map((l: any) => l.id);
    if (ownedIds.length === 0) {
      return res.status(403).json({ error: "As leads indicadas não pertencem à sua carteira." });
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in("id", ownedIds);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Registar interação em cada lead alterada (best-effort).
    const changedFields = Object.keys(updates).filter((k) => k !== "is_development").map((k) => FIELD_LABELS[k] || k);
    const now = new Date().toISOString();
    const interactionRows = ownedIds.map((leadId: string) => ({
      lead_id: leadId,
      user_id: user.id,
      interaction_type: "note",
      content: `✏️ Atualizado via Agente IA: ${changedFields.join(", ")}`,
      interaction_date: now,
    }));
    if (interactionRows.length > 0) {
      const { error: interError } = await supabase.from("interactions").insert(interactionRows);
      if (interError) console.error("[apply-chat-update] Falha a registar interação (não bloqueante):", interError);
    }

    return res.status(200).json({
      success: true,
      updatedCount: ownedIds.length,
      updatedFields: changedFields,
      leadNames: (ownedLeads || []).map((l: any) => l.name),
    });
  } catch (error: any) {
    console.error("[apply-chat-update] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
