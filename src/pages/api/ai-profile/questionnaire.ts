import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { buildQuestionnairePrompt, PROFILE_SLOTS, SLOT_MAX_CHARS } from "@/lib/server/consultantProfile";

/**
 * Transforma as respostas do questionário nos quatro papéis do perfil.
 *
 * NÃO grava nada de propósito: devolve a proposta para o consultor a ler,
 * corrigir e confirmar. O perfil é a identidade dele — não pode passar a
 * existir sem ele ver o que lá está escrito.
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

  const { answers } = req.body as { answers?: Record<string, string> };

  const respostasPreenchidas = Object.values(answers || {}).filter((v) => String(v || "").trim());
  if (respostasPreenchidas.length === 0) {
    return res.status(400).json({ error: "Responde pelo menos a uma pergunta." });
  }

  try {
    const aiResponse = await runAI({
      userId: user.id,
      task: "consultant_profile_questionnaire",
      messages: [{ role: "user", content: buildQuestionnairePrompt(answers || {}) }],
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1200,
    });

    let parsed: any = {};
    try {
      const limpo = aiResponse.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(limpo.substring(limpo.indexOf("{"), limpo.lastIndexOf("}") + 1));
    } catch {
      return res.status(422).json({
        error: "A IA não devolveu um perfil legível. Tenta outra vez.",
      });
    }

    const slots: Record<string, string> = {};
    for (const slot of PROFILE_SLOTS) {
      slots[slot] = String(parsed[slot] || "").trim().substring(0, SLOT_MAX_CHARS);
    }

    return res.status(200).json({ slots });
  } catch (error: any) {
    console.error("[ai-profile] Questionário falhou:", error);
    return res.status(500).json({
      error: error?.message || "Não foi possível compor o perfil.",
    });
  }
}
