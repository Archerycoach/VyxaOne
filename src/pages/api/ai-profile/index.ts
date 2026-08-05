import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getProfile,
  saveProfileSlots,
  PROFILE_QUESTIONS,
  PROFILE_SLOTS,
  SLOT_MAX_CHARS,
  type ProfileSlot,
} from "@/lib/server/consultantProfile";

/**
 * Perfil do consultor — ler e gravar.
 *
 * GET → perfil atual + as perguntas do questionário + as respostas já dadas.
 * PUT → grava os papéis (é sempre o consultor a confirmar, venha o texto do
 *       questionário, da edição à mão ou de uma proposta da IA).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  if (req.method === "GET") {
    const profile = await getProfile(user.id, supabaseAdmin);
    return res.status(200).json({
      profile,
      questions: PROFILE_QUESTIONS,
      maxChars: SLOT_MAX_CHARS,
    });
  }

  if (req.method === "PUT") {
    const { slots, questionnaire, source, reason, enabled } = req.body as {
      slots?: Partial<Record<ProfileSlot, string>>;
      questionnaire?: Record<string, string>;
      source?: "questionnaire" | "manual" | "ai_proposal";
      reason?: string;
      enabled?: boolean;
    };

    try {
      if (typeof enabled === "boolean") {
        await (supabaseAdmin as any)
          .from("consultant_profile")
          .upsert(
            { user_id: user.id, enabled, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      }

      if (slots && Object.keys(slots).length > 0) {
        const limpos: Partial<Record<ProfileSlot, string>> = {};
        for (const slot of PROFILE_SLOTS) {
          if (typeof slots[slot] === "string") {
            limpos[slot] = String(slots[slot]);
          }
        }

        await saveProfileSlots({
          userId: user.id,
          slots: limpos,
          source: source || "manual",
          reason,
          questionnaire,
          supabase: supabaseAdmin,
        });
      }

      const profile = await getProfile(user.id, supabaseAdmin);
      return res.status(200).json({ profile });
    } catch (error: any) {
      console.error("[ai-profile] Falha a gravar:", error);
      return res.status(500).json({ error: "Não foi possível gravar o perfil." });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
