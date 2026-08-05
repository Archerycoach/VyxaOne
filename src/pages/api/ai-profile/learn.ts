import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getProfile, SLOT_MAX_CHARS } from "@/lib/server/consultantProfile";
import { recordAiAction, getCapabilityLevel } from "@/lib/server/aiActions";

/**
 * Aprende com as correções do consultor.
 *
 * Compara os rascunhos que a IA propôs com o que ele realmente enviou, procura
 * padrões que se REPITAM, e propõe um ajuste ao Perfil da IA. A proposta entra
 * na espinha ai_actions — nunca é aplicada sem confirmação, porque isto altera
 * a identidade dele e não um campo de uma lead.
 *
 * Depois de usadas, as amostras ficam sem corpo: guarda-se a lição, não a
 * correspondência com o cliente (ver a migração 20260805160000).
 */

export const config = { maxDuration: 60 };

/** Abaixo disto não há padrão nenhum — há uma correção pontual. */
const MIN_AMOSTRAS = 3;
const MAX_AMOSTRAS = 12;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { data: amostras } = await (supabaseAdmin as any)
    .from("ai_writing_samples")
    .select("id, draft_subject, draft_body, sent_subject, sent_body, change_ratio")
    .eq("user_id", user.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_AMOSTRAS);

  const lista = (amostras || []).filter((a: any) => a.draft_body && a.sent_body);

  if (lista.length < MIN_AMOSTRAS) {
    return res.status(200).json({
      proposed: false,
      samples: lista.length,
      needed: MIN_AMOSTRAS,
      message: `Ainda só tenho ${lista.length} email${lista.length === 1 ? "" : "s"} corrigido${lista.length === 1 ? "" : "s"}. Preciso de pelo menos ${MIN_AMOSTRAS} para distinguir um hábito teu de uma correção pontual.`,
    });
  }

  const perfil = await getProfile(user.id, supabaseAdmin);

  const pares = lista
    .map((a: any, i: number) => {
      const limpar = (s: string) => String(s || "").replace(/<[^>]*>?/g, " ").replace(/\s+/g, " ").trim();
      return `EXEMPLO ${i + 1}
Assunto proposto: ${a.draft_subject || "(sem assunto)"}
Assunto enviado:  ${a.sent_subject || "(sem assunto)"}

Rascunho da IA:
${limpar(a.draft_body).substring(0, 1200)}

O que ele enviou:
${limpar(a.sent_body).substring(0, 1200)}`;
    })
    .join("\n\n---\n\n");

  const prompt = `Um consultor imobiliário português usa uma IA para escrever rascunhos de email. Abaixo estão ${lista.length} casos: o rascunho que a IA propôs e o email que ele acabou por enviar depois de o corrigir.

A tua tarefa é encontrar os padrões que SE REPETEM nas correções dele — não comentar cada caso.

PERFIL ATUAL:
Como escrevo: ${perfil?.voice || "(vazio)"}
O que nunca fazer: ${perfil?.boundaries || "(vazio)"}

${pares}

REGRAS:
- Só apontes um padrão se aparecer em pelo menos DOIS exemplos. Uma correção isolada é gosto do momento, não é a voz dele.
- Devolve o texto COMPLETO e reescrito de "Como escrevo" (não um diff), preservando o que já lá está e continua verdadeiro.
- Só devolve "O que nunca fazer" se ele apagar sistematicamente o mesmo tipo de conteúdo. Caso contrário devolve string vazia.
- Máximo ${SLOT_MAX_CHARS} caracteres por texto.
- Sê concreto e acionável ("assino sempre 'Um abraço'", "corto saudações do tipo 'espero que esteja bem'"). Nada de adjetivos.
- Se não houver padrão nenhum que se repita, devolve confident=false.

Responde SÓ com JSON:
{"confident":true|false,"voice":"...","boundaries":"","observations":["padrão 1","padrão 2"],"summary":"uma frase que resume o que mudaste e porquê"}`;

  try {
    const aiResponse = await runAI({
      userId: user.id,
      task: "consultant_profile_learn",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 1200,
    });

    let parsed: any = {};
    try {
      const limpo = aiResponse.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(limpo.substring(limpo.indexOf("{"), limpo.lastIndexOf("}") + 1));
    } catch {
      return res.status(422).json({ error: "A IA não devolveu uma proposta legível." });
    }

    const marcarUsadas = async () => {
      // Fica a lição, não o email do cliente.
      await (supabaseAdmin as any)
        .from("ai_writing_samples")
        .update({
          used_at: new Date().toISOString(),
          draft_body: null,
          sent_body: null,
          draft_subject: null,
          sent_subject: null,
        })
        .in("id", lista.map((a: any) => a.id));
    };

    if (parsed.confident !== true || !String(parsed.voice || "").trim()) {
      await marcarUsadas();
      return res.status(200).json({
        proposed: false,
        samples: lista.length,
        message: "Analisei as tuas correções mas não encontrei nenhum padrão que se repetisse. Volto a tentar quando houver mais.",
      });
    }

    const slots: Record<string, string> = {
      voice: String(parsed.voice).trim().substring(0, SLOT_MAX_CHARS),
    };
    const boundaries = String(parsed.boundaries || "").trim();
    if (boundaries) {
      slots.boundaries = boundaries.substring(0, SLOT_MAX_CHARS);
    }

    const { data: profileRow } = await (supabaseAdmin as any)
      .from("profiles")
      .select("ai_capability_levels")
      .eq("id", user.id)
      .maybeSingle();

    const level = getCapabilityLevel(profileRow?.ai_capability_levels, "profile_voice");

    if (level === "off") {
      return res.status(200).json({
        proposed: false,
        message: "A capacidade \"Ajustar o Perfil da IA\" está desligada nas definições.",
      });
    }

    const observacoes = Array.isArray(parsed.observations) ? parsed.observations.slice(0, 5) : [];

    const { id } = await recordAiAction({
      supabaseAdmin,
      userId: user.id,
      capability: "profile_voice",
      level,
      entityType: "profile",
      title: "Ajustar o Perfil da IA com base nos teus emails",
      reason: [String(parsed.summary || "").trim(), ...observacoes.map((o: string) => `• ${o}`)]
        .filter(Boolean)
        .join("\n"),
      source: `${lista.length} emails corrigidos`,
      payload: { slots },
      previousState: {
        slots: {
          voice: perfil?.voice || "",
          ...(slots.boundaries !== undefined ? { boundaries: perfil?.boundaries || "" } : {}),
        },
      },
    });

    await marcarUsadas();

    return res.status(200).json({
      proposed: true,
      actionId: id,
      samples: lista.length,
      observations: observacoes,
      summary: String(parsed.summary || ""),
      slots,
    });
  } catch (error: any) {
    console.error("[ai-profile/learn] Falhou:", error);
    return res.status(500).json({ error: error?.message || "Não foi possível analisar." });
  }
}
