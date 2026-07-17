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

  // Aceita o formato novo (edits: [{leadId, updates}]) e o antigo
  // (targetLeadIds + updates iguais) por retrocompatibilidade.
  const body = (req.body || {}) as {
    edits?: Array<{ leadId?: unknown; updates?: Record<string, unknown> }>;
    targetLeadIds?: unknown;
    updates?: Record<string, unknown>;
  };

  let rawEdits: Array<{ leadId?: unknown; updates?: Record<string, unknown> }> = Array.isArray(body.edits) ? body.edits : [];
  if (rawEdits.length === 0 && Array.isArray(body.targetLeadIds)) {
    rawEdits = body.targetLeadIds.map((leadId) => ({ leadId, updates: body.updates }));
  }

  // Revalidação: allowlist por edição + só ids que sejam string.
  const validEdits = rawEdits
    .map((e) => ({ leadId: typeof e.leadId === "string" ? e.leadId : null, updates: validateLeadUpdates(e.updates) }))
    .filter((e): e is { leadId: string; updates: Record<string, unknown> } => !!e.leadId && Object.keys(e.updates).length > 0);

  if (validEdits.length === 0) {
    return res.status(400).json({ error: "Nada de válido para alterar." });
  }

  try {
    // Confirmar posse: só leads visíveis ao utilizador (RLS).
    const ids = Array.from(new Set(validEdits.map((e) => e.leadId)));
    const { data: ownedLeads, error: fetchError } = await supabase
      .from("leads")
      .select("id, name")
      .in("id", ids);

    if (fetchError) return res.status(500).json({ error: fetchError.message });

    const ownedIds = new Set((ownedLeads || []).map((l: any) => l.id));
    const nameById = new Map((ownedLeads || []).map((l: any) => [l.id, l.name]));
    const editsToApply = validEdits.filter((e) => ownedIds.has(e.leadId));
    if (editsToApply.length === 0) {
      return res.status(403).json({ error: "As leads indicadas não pertencem à sua carteira." });
    }

    const now = new Date().toISOString();
    const changedFieldsSet = new Set<string>();
    const updatedNames: string[] = [];
    const interactionRows: any[] = [];

    // Aplica cada edição (valores podem diferir por lead).
    for (const e of editsToApply) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ ...e.updates, updated_at: now })
        .eq("id", e.leadId);
      if (updateError) {
        console.error(`[apply-chat-update] Erro ao atualizar lead ${e.leadId}:`, updateError);
        continue;
      }
      const fields = Object.keys(e.updates).filter((k) => k !== "is_development").map((k) => FIELD_LABELS[k] || k);
      fields.forEach((f) => changedFieldsSet.add(f));
      updatedNames.push(nameById.get(e.leadId) || "?");
      interactionRows.push({
        lead_id: e.leadId,
        user_id: user.id,
        interaction_type: "note",
        content: `✏️ Atualizado via Agente IA: ${fields.join(", ")}`,
        interaction_date: now,
      });
    }

    if (interactionRows.length > 0) {
      const { error: interError } = await supabase.from("interactions").insert(interactionRows);
      if (interError) console.error("[apply-chat-update] Falha a registar interação (não bloqueante):", interError);
    }

    return res.status(200).json({
      success: true,
      updatedCount: updatedNames.length,
      updatedFields: Array.from(changedFieldsSet),
      leadNames: updatedNames,
    });
  } catch (error: any) {
    console.error("[apply-chat-update] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
